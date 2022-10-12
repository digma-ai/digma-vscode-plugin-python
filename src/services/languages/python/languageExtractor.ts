import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { IMethodExtractor, ISpanExtractor } from '../extractors';
import { LanguageExtractor } from '../languageExtractor';
import { IModulePathToUriConverter, PhysicalModulePathToUriConverter } from '../modulePathToUriConverters';
import { PythonMethodExtractor } from './methodExtractor';
import { PythonSpanExtractor } from './spanExtractor';


export class PythonLanguageExtractor extends LanguageExtractor 
{
    public requiredExtensionLoaded: boolean = false;

    public get requiredExtensionId(): string {
        return 'ms-python.python';
    }

    public get documentFilter(): vscode.DocumentFilter {
        return { scheme: 'file', language: 'python' };
    }

    public get methodExtractors(): IMethodExtractor[] {
        return [
            new PythonMethodExtractor()
        ];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new PythonSpanExtractor(codeInspector)
        ];
    }

    public async getModulePathToUriConverters(): Promise<IModulePathToUriConverter[]> {
        return [
            new PhysicalModulePathToUriConverter(),
        ];
    }
}
