import * as vscode from 'vscode';
import { CodeInspector } from '../codeInspector';
import { IMethodPositionSelector, DefaultMethodPositionSelector } from './methodPositionSelector';
import { IMethodExtractor, IParametersExtractor, IEndpointExtractor, ISpanExtractor, ISymbolAliasExtractor, EmptySymbolAliasExtractor } from './extractors';
import { BasicParametersExtractor } from './defaultImpls';

export interface ILanguageExtractor {
    requiredExtensionLoaded: boolean;
    get requiredExtensionId(): string;
    get documentFilter(): vscode.DocumentFilter;
    get methodExtractors(): IMethodExtractor[];
    get parametersExtractor(): IParametersExtractor;
    get methodPositionSelector(): IMethodPositionSelector;
    getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[];
    getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[];
    validateConfiguration(): Promise<void>;
    get symbolAliasExtractor(): ISymbolAliasExtractor;
}

export abstract class LanguageExtractor implements ILanguageExtractor {
    
    public abstract requiredExtensionLoaded: boolean;

    public abstract get requiredExtensionId(): string;

    public abstract get documentFilter(): vscode.DocumentFilter;

    public abstract get methodExtractors(): IMethodExtractor[];

    public get symbolAliasExtractor(): ISymbolAliasExtractor {
        return new EmptySymbolAliasExtractor();
    }
    
    public get parametersExtractor(): IParametersExtractor {
        return new BasicParametersExtractor();
    }

    public get methodPositionSelector(): IMethodPositionSelector {
        return new DefaultMethodPositionSelector();
    }

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [];
    }

    public abstract getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[];

    public async validateConfiguration(): Promise<void> {
    }
}
