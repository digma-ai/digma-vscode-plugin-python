
import * as vscode from 'vscode';
import * as moment from 'moment';
import { SymbolInformation, DocumentSymbol } from "vscode-languageclient";
import { AnalyticsProvider, ICodeObjectSummary as ICodeObjectSummary, IErrorFlowFrame } from './analyticsProvider';
import { Dictionary, Future } from './utils';
import { ISupportedLanguage, SymbolInfo } from './languageSupport';

export function trendToCodIcon(trend: number): string 
{
    if(trend < 0)
        return `${trend}$(arrow-down)`;
    if(trend > 0)
        return `+${trend}$(arrow-up)`;
    return '';
}

export function trendToAsciiIcon(trend: number): string 
{
    if(trend < 0)
        return `${trend}\u2193`;  // \u2193 = ArrowDown
    if(trend > 0)
        return `+${trend}\u2191`;  // \u2191 = ArrowUp
    return '';
}

export class SymbolProvider 
{
    constructor(private _supportedLanguages: ISupportedLanguage[]) 
    {
    }

    public async getSymbols(document: vscode.TextDocument) : Promise<SymbolInfo[]>
    {
        const supportedLanguage = this._supportedLanguages.find(x => vscode.languages.match(x.documentFilter, document) > 0);
        if (!supportedLanguage ||
            !(supportedLanguage.requiredExtentionLoaded || await this.loadRequiredExtention(supportedLanguage)))
        {
            return [];
        }

        const result: any[] = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

        if (result && result.length) {
            if ((result[0] as any).range) {
                // Document symbols
                const allDocSymbols = result as DocumentSymbol[];
                const symbolInfos = supportedLanguage.extractSymbolInfos(document, allDocSymbols);
                return symbolInfos;
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }

        return [];
    }

    private async loadRequiredExtention(language: ISupportedLanguage) : Promise<boolean>
    {
        var extention = vscode.extensions.getExtension(language.requiredExtentionId);
        if (!extention) 
        {
            const installOption = `Install ${language.requiredExtentionId}`;
            const ignoreOption = `Ignore python files`;
            let sel = await vscode.window.showErrorMessage(
                `Digma cannot process ${language.documentFilter.language} files properly without '${language.requiredExtentionId}' installed.`,
                ignoreOption,
                installOption
            )
            if(sel == installOption)
                vscode.commands.executeCommand('workbench.extensions.installExtension', language.requiredExtentionId);
            else if(sel == ignoreOption)
                this._supportedLanguages = this._supportedLanguages.filter(x => x != language);
            return false;
        }
        if(!extention.isActive)
            await extention.activate();

        language.requiredExtentionLoaded = true;
        return true;
    }
}