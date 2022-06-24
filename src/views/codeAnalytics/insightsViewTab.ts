import * as vscode from "vscode";
import {
    AnalyticsProvider,
    UsageStatusResults,
} from "../../services/analyticsProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { Logger } from "../../services/logger";
import { IInsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";
import { ListViewRender } from "../ListView/ListViewRender";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { ICodeObjectScopeGroupCreator } from "./CodeObjectGroups/ICodeObjectScopeGroupCreator";
import { IListGroupItemBase } from "../ListView/IListViewGroupItem";
import { CodeObjectGroupDiscovery } from "./CodeObjectGroups/CodeObjectGroupDiscovery";
import { EmptyGroupItemTemplate } from "../ListView/EmptyGroupItemTemplate";
import { InsightItemGroupRendererFactory, InsightListGroupItemsRenderer } from "../ListView/IListViewItem";
import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { FetchError } from "node-fetch";
import { CannotConnectToDigmaInsight } from "./AdminInsights/adminInsights";
import { Settings } from "../../settings";
import { NoCodeObjectMessage } from "./AdminInsights/noCodeObjectMessage";



export class InsightsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;
    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
        private _groupViewItemCreator: ICodeObjectScopeGroupCreator,
        private _listViewItemsCreator: IInsightListViewItemsCreator,
        private _documentInfoProvider: DocumentInfoProvider,
        private _viewUris: WebViewUris,
        private _noCodeObjectsMessage: NoCodeObjectMessage) { }
    
    
    onRefreshRequested(codeObject: CodeObjectInfo): void {

            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);

        

    }
    
    dispose() { }

    get tabTitle(): string { return "Insights"; }
    get tabId(): string { return "tab-insights"; }
    get viewId(): string { return "view-insights"; }

    private async refreshListViewRequested(codeObject: CodeObjectInfo) {

        this.updateListView(HtmlHelper.getLoadingMessage("Loading insights..."));
        this.updateSpanListView("");
        this.clearSpanLabel();
        let responseItems: any [] | undefined = undefined;
        let usageResults: UsageStatusResults;

        const editor = vscode.window.activeTextEditor;
        if(!editor) {
            return;
        }
        const docInfo = await this._documentInfoProvider.getDocumentInfo(editor.document);
        if(!docInfo) {
            return;
        }
        if (!codeObject || !codeObject.id) {
            let html = await this._noCodeObjectsMessage.showCodeSelectionNotFoundMessage(docInfo);
            this.updateListView(html);
            this.updateSpanListView("");
            this._viewedCodeObjectId=undefined;
            return;
        }
        const methodInfo = docInfo.methods.single(x => x.id == codeObject.id);
        const codeObjectsIds = [methodInfo.idWithType]
            .concat(methodInfo.relatedCodeObjects.map(r => r.idWithType));
        try
        {
            responseItems = await this._analyticsProvider.getInsights(codeObjectsIds);
            //temp ugly workaround
            var bottleneck = responseItems.find(x=>x.type ==='SlowestSpans');
            var endpointBottlneck = responseItems.find(x=>x.type ==='SpanEndpointBottleneck');

            if (bottleneck && endpointBottlneck){
                responseItems=responseItems.filter(x=>x.type!=='SpanEndpointBottleneck');
            }

            usageResults = await this._analyticsProvider.getUsageStatus(codeObjectsIds);

        }
        catch(e)
        {
            let fetchError = e as FetchError;
            //connection issue
            if (fetchError && fetchError.code && fetchError.code==='ECONNREFUSED'){
                let html ='<div id="insightList" class="list">';
                html +=new CannotConnectToDigmaInsight(this._viewUris,Settings.url.value).getHtml();
                html+=`</div>`;
                this.updateListView(html);

            }
            else{

                Logger.error(`Failed to get codeObjects insights`, e);
                this.updateListView(HtmlHelper.getErrorMessage("Failed to fetch insights from Digma server.\nSee Output window from more info."));

            }

            return;

        }
        try{
           
            const groupItems = await new CodeObjectGroupDiscovery(this._groupViewItemCreator).getGroups(usageResults);
            const listViewItems = await this._listViewItemsCreator.create( responseItems);
            const codeObjectGroupEnv = new CodeObjectGroupEnvironments(this._viewUris);
            const groupRenderer = new InsightItemGroupRendererFactory(new EmptyGroupItemTemplate(this._viewUris), codeObjectGroupEnv, usageResults);
            
            const html = codeObjectGroupEnv.getUsageHtml(undefined,undefined,usageResults) + new ListViewRender(listViewItems, groupItems, groupRenderer).getHtml();
        
            if(html)
            {
                this.updateListView(html);
            }
            else{
                this.updateListView(HtmlHelper.getInfoMessage("No insights about this code object yet."));
            }
        }
        catch(e)
        {
            Logger.error(`Failed to get create insights view`, e);
            throw e;
        }
        this._viewedCodeObjectId = codeObject.id;
    }

    public onReset(): void{
        this._viewedCodeObjectId = undefined;
    }

    public onActivate(codeObject: CodeObjectInfo): void {
        if (!codeObject || !codeObject.id||codeObject.id != this._viewedCodeObjectId) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);

        }
    }

    public onUpdated(codeObject: CodeObjectInfo): void {
        if (!codeObject || !codeObject.id|| (codeObject.id !== this._viewedCodeObjectId)) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
    }

    public onDectivate(): void {
    }

    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) {
        let html = HtmlHelper.getCodeObjectLabel(codeObject.methodName);
        this._channel?.publish(
            new UiMessage.Set.CodeObjectLabel(html)
        );
    }

    private clearSpanLabel(){
        this._channel?.publish(
            new UiMessage.Set.SpanObjectLabel("")
        );
    }

    private updateSpanListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.SpanList(html));
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.InsightsList(html));
    }

    

    public getHtml(): string {
        return /*html*/`
            <div id="codeObjectScope" class="codeobject-selection"></div>
            <div id="insightList" class="list"></div>
            <div class="spacer" style="height:15px"></div>
            <div id="spanScope" ></div>
            <div id="spanList" class="list"></div>

            `;
    }
}
