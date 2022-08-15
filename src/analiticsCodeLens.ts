import * as vscode from 'vscode';
import { EndpointCodeObjectSummary, MethodCodeObjectSummary, SpanCodeObjectSummary } from './services/analyticsProvider';
import { Settings } from './settings';
import { DocumentInfoProvider, MethodInfo } from './services/documentInfoProvider';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { WorkspaceState } from './state';
import { UiMessage } from './views-ui/codeAnalytics/contracts';


export class AnaliticsCodeLens implements vscode.Disposable
{

    private _provider: CodelensProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(documentInfoProvider: DocumentInfoProvider,
                state: WorkspaceState)
    {
        this._provider = new CodelensProvider(documentInfoProvider,state);

        this._disposables.push(vscode.commands.registerCommand(CodelensProvider.clickCommand, async (methodInfo: MethodInfo, environment:string) => {
            if(vscode.window.activeTextEditor)
                vscode.window.activeTextEditor.selection = new vscode.Selection(methodInfo.range.start, methodInfo.range.start);

            await vscode.commands.executeCommand(CodeAnalyticsView.Commands.Show, environment);
        }));
        this._disposables.push(vscode.workspace.onDidChangeConfiguration((_) => {
            this._provider.raiseOnDidChangeCodeLenses();
        },this._disposables));

        this._provider.raiseOnDidChangeCodeLenses();

        this._disposables.push(vscode.languages.registerCodeLensProvider(
            documentInfoProvider.symbolProvider.languageExtractors.map(x => x.documentFilter),
            this._provider)
        );
    }

    public async refreshRequested() {
        this._provider.raiseOnDidChangeCodeLenses();
    }

    public dispose() {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

class CodelensProvider implements vscode.CodeLensProvider<vscode.CodeLens> 
{

    public static readonly clickCommand = 'digma.lensClicked';
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private _documentInfoProvider: DocumentInfoProvider,
        private _state: WorkspaceState)
    {
    }

    public raiseOnDidChangeCodeLenses(){
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> 
    {
        if (!Settings.enableCodeLens.value) 
            return [];

        const documentInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!documentInfo)
            return [];

        const codelens: vscode.CodeLens[] = [];
        for(let methodInfo of documentInfo.methods)
        {
            for (let alias of methodInfo.aliases){
                const errorInfo = documentInfo.summaries.get(MethodCodeObjectSummary, alias);
                if (errorInfo!=null && errorInfo.score>=70){
                    codelens.push(new vscode.CodeLens(methodInfo.range, {
                        title:  'Error Hotspot',
                        // tooltip: methodInfo.symbol.id,
                        command: CodelensProvider.clickCommand,
                        arguments: [methodInfo]
                    }));

                }
            }
        
            const spans = documentInfo.spans.filter(e => e.range.intersection(methodInfo.range) != undefined);
            if(spans.length>0){
                let spansWithInsights = spans.filter(e=> documentInfo.insights.get( e.id)!= undefined);
       
                for (let span of spansWithInsights){
                    const insightsWithDecorators 
                        = documentInfo.insights.get( span.id)
                            .filter(x=>x.decorators);
                    
                    for (const insight of insightsWithDecorators
                            .filter(x=>x.environment==this._state.environment)){
                      
                        for (const decorator of insight.decorators){

                            let title =  decorator.title;
                            if (decorator.importance=="High"){
                                title='❗️' + title; 
    
                            }
                            codelens.push(new vscode.CodeLens(span!.range, {
                                title:  title,
                                tooltip: decorator.description,
                                command: CodelensProvider.clickCommand,
                                arguments: [methodInfo, insight.environment]
                            }));

                        } 
                    }

                    for (const insight of insightsWithDecorators
                        .filter(x=>x.environment!=this._state.environment)){

                        for (const decorator of insight.decorators.filter(x=>x.importance=="High")){
                            
                            let title =  decorator.title;
                            if (decorator.importance=="High"){
                                title=`[${insight.environment}] ❗️${title}`; 
    
                            }
                            codelens.push(new vscode.CodeLens(span!.range, {
                                title:  title,
                                tooltip: decorator.description,
                                command: CodelensProvider.clickCommand,
                                arguments: [methodInfo, insight.environment]
                            }));

                        } 
                    }

                                      // const summary = documentInfo.summaries.get(SpanCodeObjectSummary, span.id);

                    // var spanSummary = summary as SpanCodeObjectSummary;    
                    // if (spanSummary && spanSummary.isBottleneck){
                    //     codelens.push(new vscode.CodeLens(span!.range, {
                    //             title:  'Bottleneck',
                    //             tooltip: `Bottleneck area`,
                    //             command: CodelensProvider.clickCommand,
                    //             arguments: [methodInfo]
                    //         }));
                    // }   
                    // console.log(spanSummary.insightsCount);           
                }
                // if(summary?. || summary?.highUsage)
                // {
                //     codelens.push(new vscode.CodeLens(endpoint!.range, {
                //         title:  summary.lowUsage ? 'Low Usage' : 'High Usage',
                //         tooltip: `Maximum of ${summary.maxCallsIn1Min} requests per minute`,
                //         command: CodelensProvider.clickCommand,
                //         arguments: [methodInfo]
                //     }));
                // }

                // if(summary?.slow)
                // {
                //     codelens.push(new vscode.CodeLens(endpoint!.range, {
                //         title:  "Slow Endpoint",
                //         tooltip: `Slow endpoint found`,
                //         command: CodelensProvider.clickCommand,
                //         arguments: [methodInfo]
                //     }));
                // }

                
            }

            const endpoints = documentInfo.endpoints.filter(e => e.range.intersection(methodInfo.range) != undefined);
            if(endpoints.length>0){
                let endpoint = endpoints.find(e=> documentInfo.summaries.get(EndpointCodeObjectSummary, e.id)!= undefined);
                if (endpoint==null){
                    continue;
                }
                const summary = documentInfo.summaries.get(EndpointCodeObjectSummary, endpoint.id);
                if(summary?.lowUsage || summary?.highUsage)
                {
                    codelens.push(new vscode.CodeLens(endpoint!.range, {
                        title:  summary.lowUsage ? 'Low Usage' : 'High Usage',
                        tooltip: `Maximum of ${summary.maxCallsIn1Min} requests per minute`,
                        command: CodelensProvider.clickCommand,
                        arguments: [methodInfo]
                    }));
                }

                if(summary?.slow)
                {
                    codelens.push(new vscode.CodeLens(endpoint!.range, {
                        title:  "Slow Endpoint",
                        tooltip: `Slow endpoint found`,
                        command: CodelensProvider.clickCommand,
                        arguments: [methodInfo]
                    }));
                }

                
            }
            
        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) : Promise<vscode.CodeLens> 
    {
        return codeLens;
    }
}