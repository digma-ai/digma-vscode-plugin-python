import * as vscode from 'vscode';
import { ErrorFlowResponse, ParamStats } from '../../services/analyticsProvider';
import { IParameter, ParameterDecorator } from "../../services/parameterDecorator";
import { DocumentInfoProvider, ParameterInfo } from '../../services/documentInfoProvider';

export class ErrorFlowParameterDecorator extends ParameterDecorator<IParameter>
{
    public _errorFlowResponse?: ErrorFlowResponse;

    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
        //"\uebe2".replace('uebe2','eabd')
        super("\ueabd", _documentInfoProvider.symbolProvider.supportedLanguages.map(x => x.documentFilter));
    }

    public get errorFlowResponse(): ErrorFlowResponse | undefined
    {
        return this._errorFlowResponse;
    }

    public set errorFlowResponse(value: ErrorFlowResponse | undefined)
    {
        this._errorFlowResponse = value;
        this.refreshAll();
    }

    protected async getParameters(document: vscode.TextDocument): Promise<IParameter[]> 
    {
        let parameters: IParameter[] = [];

        const frames = this.errorFlowResponse?.frameStacks?.flatMap(s => s.frames) || [];
        if(!frames)
            return [];

        const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!docInfo)
            return [];

        for(let methodInfo of docInfo.methods)
        {
            const frame = frames.firstOrDefault(f => f.codeObjectId == methodInfo.symbol.id);
            if(!frame)
                continue;
            
            for(let parameterInfo of methodInfo.parameters)
            {
                const parameterStats = frame.parameters.firstOrDefault(p => p.paramName == parameterInfo.name);
                if(!parameterStats || !parameterStats.alwaysNoneValue)
                    continue;
                
                parameters.push({
                    name: parameterInfo.name,
                    range: parameterInfo.range,
                    hover: this.getParameterHover(parameterInfo)
                });
            }
        }
        
        return parameters;
    }   

    private getParameterHover(parameter: ParameterInfo): vscode.MarkdownString
    {
        const html = /*html*/ `<code>${parameter.name}</code> is always <code>None</code>`;
        let m = new vscode.MarkdownString(html);
        m.supportHtml = true;
        m.isTrusted = true;
        return m;
    }
}