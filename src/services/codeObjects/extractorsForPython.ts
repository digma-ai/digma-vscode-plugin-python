import * as vscode from 'vscode';
import { Token, TokenType } from "../languages/symbolProvider";
import { EndpointInfo, IEndpointExtractor } from "./extractors";


export class FastapiEndpointExtractor implements IEndpointExtractor
{
    public language = 'python';

    extractEndpoints(document: vscode.TextDocument, tokens: Token[]): EndpointInfo[] 
    {
        // Ensure fastapi module was imported
        if(!tokens.any(t => t.text == 'fastapi' && t.type == TokenType.module))
            return [];

        // Search for "@app.get" decorators
        const results: EndpointInfo[] = []
        for(let i=0; i<tokens.length-1; i++)
        {
            const appToken = tokens[i];
            const methodToken = tokens[i+1];
            if (appToken.text != 'app' || appToken.type != TokenType.variable || methodToken.type != TokenType.method)
                continue;

            const method = methodToken.text;
            if(!['post', 'get', 'put', 'delete', 'options', 'head', 'patch', 'trace'].includes(method))
                continue;
            
            const lineText = document.getText(new vscode.Range(
                appToken.range.start, 
                new vscode.Position(methodToken.range.end.line, 1000)));
            const match = new RegExp(`^app\\.${method}\\("([^"]+)"`).exec(lineText);
            if (!match)
                continue;
            
            results.push({
                line: methodToken.range.end.line,
                method: method, 
                path: match[0]
            });
        }
        return []
    }
}