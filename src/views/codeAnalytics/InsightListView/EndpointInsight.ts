import { IListViewItem } from "../../ListView/IListViewItem";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";
import { EndpointSchema, UsageStatusResults } from '../../../services/analyticsProvider';
import { WebviewChannel, WebViewUris } from "../../webViewUtils";
import { DecimalRounder } from "../../utils/valueFormatting";
import { EditorHelper } from "../../../services/EditorHelper";
import { DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { UiMessage } from "../../../views-ui/codeAnalytics/contracts";
import { Uri } from "vscode";
import path = require("path");
import moment = require("moment");
import { Duration, Percentile, SpanInfo } from "./CommonInsightObjects";
import { decimal, integer } from "vscode-languageclient";
import { Settings } from "../../../settings";
import { renderTraceLink } from "./Common/TraceLinkRender";
import { InsightTemplateHtml } from "./ItemRender/insightTemplateHtml";
import { SpanLinkResolver } from "../../../services/spanLinkResolver";
import { CodeObjectLocationHints } from '../../../services/languages/modulePathToUriConverters';


export interface EndpointInsight extends CodeObjectInsight {
    route: string;
    endpointSpan: string;

}

export interface LowUsageInsight extends EndpointInsight {
    maxCallsIn1Min: number;
}


export interface SlowSpanInfo {
    spanInfo: SpanInfo;
    probabilityOfBeingBottleneck?: number;
    avgDurationWhenBeingBottleneck?: Duration;

    // Obsolete
    p50: Percentile;
    p95: Percentile;
    p99: Percentile;
}

export interface HighlyOccurringSpanInfo {
    occurrences: number;
    internalSpan: SpanInfo;
    clientSpan: SpanInfo;
    traceId: string;
    duration: Duration;
    fraction: decimal;
}

export interface EPNPlusSpansInsight extends EndpointInsight {
    spans: HighlyOccurringSpanInfo[];
}
export interface SlowestSpansInsight extends EndpointInsight {
    spans: SlowSpanInfo[];
}
export class UsageViewItemsTemplate {

    constructor(
        private viewUris: WebViewUris
    ) { }

    public generateHtml(
        insight: LowUsageInsight,
        header: string,
        description: string,
        image: string) {
        const value = new DecimalRounder().getRoundedString(insight.maxCallsIn1Min);
        const template = new InsightTemplateHtml({
            title: header,
            description: description,
            icon: this.viewUris.image(image),
            body: `<span title="Maximum of ${value} requests per minute">${value}/min</span>`,
            insight,
        }, this.viewUris);
        return template.renderHtml();
    }
}

export class LowUsageListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private template: UsageViewItemsTemplate
    ) {
    }

    public async create( codeObjectsInsight: LowUsageInsight[]): Promise<IListViewItem[]> {
        return codeObjectsInsight.map(x=>this.createListViewItem(x));
    }

    public createListViewItem(codeObjectsInsight: LowUsageInsight): IListViewItem {
        return {
            getHtml: () => this.template.generateHtml(codeObjectsInsight, "Endpoint low traffic", "Servicing a low number of requests", "traffic-low.svg"),
            sortIndex: 0,
            groupId: codeObjectsInsight.endpointSpan
        };
    }


}

export interface NormalUsageInsight extends EndpointInsight {
    maxCallsIn1Min: number;
}

export class NormalUsageListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private template: UsageViewItemsTemplate
    ) {
    }


    public async create( codeObjectsInsight: NormalUsageInsight[]): Promise<IListViewItem[]> {
        return codeObjectsInsight.map(x=>this.createListViewItem(x));
    }

    public createListViewItem(codeObjectsInsight: NormalUsageInsight): IListViewItem {
        return {
            getHtml: () => this.template.generateHtml(codeObjectsInsight, "Endpoint normal level of traffic", "Servicing an average number of requests", "traffic-normal.svg"),
            sortIndex: 0,
            groupId: codeObjectsInsight.endpointSpan
        };
    }

}

export interface HighUsageInsight extends EndpointInsight {
    maxCallsIn1Min: number;
}

export interface SlowEndpointInsight extends EndpointInsight {
    endpointsMedian: Duration;
    endpointsMedianOfMedians: Duration;
    endpointsMedianOfP75: Duration;
    endpointsP75: Duration;
    min: Duration;
    max: Duration;
    mean: Duration;
    median: Duration;
    p75: Duration;
    p95: Duration;
    p99: Duration;
}

export class HighUsageListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private template: UsageViewItemsTemplate
    ) {
    }


    public createListViewItem(codeObjectsInsight: HighUsageInsight): IListViewItem {
        return {
            getHtml: () => this.template.generateHtml(codeObjectsInsight, "Endpoint high traffic", "Servicing a high number of requests", "traffic-high.svg"),
            sortIndex: 0,
            groupId: codeObjectsInsight.endpointSpan
        };
    }

    public async create( codeObjectsInsight: HighUsageInsight[]): Promise<IListViewItem[]> {
        return codeObjectsInsight.map(x=>this.createListViewItem(x));
    }

}


export class SlowestSpansListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private _viewUris: WebViewUris,
        private _editorHelper: EditorHelper,
        private _documentInfoProvider: DocumentInfoProvider,
        private _channel: WebviewChannel,
        private _spanLinkResolver : SpanLinkResolver

    ) {
        this._channel.consume(UiMessage.Notify.GoToFileAndLine, e => this.goToFileAndLine(e.file!, e.line!));

    }
    private async goToFileAndLine(file: string , line: number ) {
        let doc = await this._editorHelper.openTextDocumentFromUri(Uri.parse(file));
        this._editorHelper.openFileAndLine( doc,line );
    }

    public async createListViewItem(codeObjectsInsight: SlowestSpansInsight): Promise<IListViewItem> {
        
        var spans = codeObjectsInsight.spans;

        const hints:CodeObjectLocationHints[] = 
            this._spanLinkResolver.codeHintsFromSpans(spans.map(x=>x.spanInfo));
        var spansLocations = await this._spanLinkResolver.searchForSpansByHints(hints);

        var items :string[] = [];
                        
        for (let i=0;i<spansLocations.length;i++){

            let result = spansLocations[i];
            const slowSpan = spans[i];

            items.push(`
                <div class="endpoint-bottleneck-insight" title="${this.getTooltip(slowSpan)}">
                    <div class="span-name flex-row ${result ? "link" : ""}" data-code-uri="${result?.documentUri}" data-code-line="${result?.range.end.line!+1}">
                        <span class="left-ellipsis">${slowSpan.spanInfo.displayName}</span>
                    </div>
                    <div class="span-description">${this.getDescription(slowSpan)}</div>
                </div>`);
        }

        const template = new InsightTemplateHtml({
            title: {
                text:"Span Bottleneck",
                tooltip: "Spans that take more than 50% of the endpoint duration"
            },
            description: "The following spans are slowing request handling",
            icon: this._viewUris.image("bottleneck.svg"),
            body: items.join(''),
            insight: codeObjectsInsight,
        }, this._viewUris);

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.endpointSpan
        };
    }

    private getDescription(span: SlowSpanInfo){
        if(span.probabilityOfBeingBottleneck && span.avgDurationWhenBeingBottleneck)
        {
            return `Slowing ${(span.probabilityOfBeingBottleneck*100).toFixed(0)}% of the requests (~${span.avgDurationWhenBeingBottleneck.value}${span.avgDurationWhenBeingBottleneck.unit})`;
        }
        else // Obsolete
        {
            if(span.p50.fraction > 0.4)
                return `50% of the users by up to ${span.p50.maxDuration.value}${span.p50.maxDuration.unit}`;
            if(span.p95.fraction > 0.4)
                return `5% of the users by up to ${span.p95.maxDuration.value}${span.p95.maxDuration.unit}`;
            return `1% of the users by up to ${span.p99.maxDuration.value}${span.p99.maxDuration.unit}`;
        }
    }

    private getTooltip(span: SlowSpanInfo){
        //&#13;
        return span.spanInfo.displayName;

// Percentage of time spent in span:
// Median: ${(span.p50.fraction*100).toFixed(0)}% ~${span.p50.maxDuration.value}${span.p50.maxDuration.unit}
// P95:    ${(span.p95.fraction*100).toFixed(0)}% ~${span.p95.maxDuration.value}${span.p95.maxDuration.unit}
// P99:    ${(span.p99.fraction*100).toFixed(0)}% ~${span.p99.maxDuration.value}${span.p99.maxDuration.unit}`
    }
    
    public async create( codeObjectsInsight: SlowestSpansInsight[]): Promise<IListViewItem[]> {
        
        let items:IListViewItem[] = [];
        for (const insight of codeObjectsInsight){
            items.push(await this.createListViewItem(insight));

        }
        return items;
    }

}

export class EPNPlusSpansListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private _viewUris: WebViewUris,
        private _editorHelper: EditorHelper,
        private _documentInfoProvider: DocumentInfoProvider,
        private _channel: WebviewChannel,
        private _spanLinkResolver: SpanLinkResolver

    ) {
        this._channel.consume(UiMessage.Notify.GoToFileAndLine, e => this.goToFileAndLine(e.file!, e.line!));

    }
    private async goToFileAndLine(file: string , line: number ) {
        let doc = await this._editorHelper.openTextDocumentFromUri(Uri.parse(file));
        this._editorHelper.openFileAndLine( doc,line );
    }

    public async createListViewItem(codeObjectsInsight: EPNPlusSpansInsight): Promise<IListViewItem> {
        
        var spans = codeObjectsInsight.spans.filter(x=>x.internalSpan);

        const hints:CodeObjectLocationHints[] = 
            this._spanLinkResolver.codeHintsFromSpans(spans.map(x=>x.internalSpan));
        
        var spansLocations = await this._spanLinkResolver.searchForSpansByHints(hints);

        var items :string[] = [];
                        
        for (let i=0;i<spansLocations.length;i++){  

            let result = spansLocations[i];
            const slowSpan = spans[i];

            items.push(`
                <div class="endpoint-bottleneck-insight" >
                    <div class="span-name flex-row ${result ? "link" : ""}" data-code-uri="${result?.documentUri}" data-code-line="${result?.range.end.line!+1}">
                        <span class="left-ellipsis">${slowSpan.internalSpan.displayName}</span>
                    </div>
                </div>`);
        }

        let traceHtml=renderTraceLink(codeObjectsInsight.spans.firstOrDefault()?.traceId,codeObjectsInsight.endpointSpan);

        let fractionSt='';
        const fraction =codeObjectsInsight.spans.firstOrDefault()?.fraction;
        if (fraction<0.01){
            fractionSt="minimal";
        }
        else{
            fractionSt=`${fraction.toPrecision(1)} of request` ;
        }
        let statsHtml = `
        <div style="margin-top:0.5em" class="flex-row">
                            
            <span class="error-property flex-stretch">
                <span class="label">Impact</span>
                <span>${fractionSt}</span>
            </span>
            <span class="error-property flex-stretch">
                <span class="label">Duration</span>
                <span>${codeObjectsInsight.spans.firstOrDefault().duration.value} ${codeObjectsInsight.spans.firstOrDefault().duration.unit}</span>
            </span>
            </div>
        `;
        
        const template = new InsightTemplateHtml({
            title: {
                text:"Suspected N-Plus-1",
                tooltip: "Repeating select query pattern suggests N-Plus-One"
            },
            description: "Check the following locations:",
            icon: this._viewUris.image("sql.png"),
            body: ` <div>
                        ${items.join('')}
                    </div>
                    ${statsHtml}`,
            buttons: [traceHtml],
            insight: codeObjectsInsight,
        }, this._viewUris);

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.endpointSpan
        };
    }

   
    public async create( codeObjectsInsight: EPNPlusSpansInsight[]): Promise<IListViewItem[]> {
        
        let items:IListViewItem[] = [];
        for (const insight of codeObjectsInsight){
            items.push(await this.createListViewItem(insight));

        }
        return items;
    }

}




export class SlowEndpointListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(private viewUris: WebViewUris
    ) {
    }

    private duration(duration: Duration) {
        return `${duration.value}${duration.unit}`;
    }

    private computePercentageDiff(value: number, compare: number) {

        return `${(((value / compare)-1) * 100).toFixed(0)}%`;
    }
    public createListViewItem(codeObjectsInsight: SlowEndpointInsight): IListViewItem {
        const tooltip = 
        `server processed 50% of requests in less than ${this.duration(codeObjectsInsight.endpointsMedian)}\n`+
        `server processed 25% of requests in higher than ${this.duration(codeObjectsInsight.endpointsP75)}`;

        const template = new InsightTemplateHtml({
            title: {
                text:"Slow Endpoint",
                tooltip: tooltip
            },
            description: `<span>On average requests are slower than other endpoints by</span> 
                          <span class="negative-value">${this.computePercentageDiff(codeObjectsInsight.median.raw, codeObjectsInsight.endpointsMedianOfMedians.raw)}</span>`,
            icon: this.viewUris.image("snail.svg"),
            body: this.duration(codeObjectsInsight.median),
            insight: codeObjectsInsight,
        }, this.viewUris);

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.endpointSpan
        };
    }

    public async create( codeObjectsInsight: SlowEndpointInsight[]): Promise<IListViewItem[]> {
        return codeObjectsInsight.map(x=>this.createListViewItem(x));
    }

}


export function adjustHttpRouteIfNeeded(route: string): string {
    const origValue = route;
    if (origValue.startsWith(EndpointSchema.HTTP)) {
        return origValue;
    }
    if (origValue.startsWith(EndpointSchema.RPC)) {
        return origValue;
    }
    if (origValue.startsWith(EndpointSchema.CONSUMER)) {
        return origValue;
    }
    // default behaviour, to be backword compatible, where did not have the scheme part of the route, so adding it as HTTP one
    return EndpointSchema.HTTP + origValue;
}

export function adjustHttpInsightIfNeeded(endpointInsight: EndpointInsight): void {

    endpointInsight.route = adjustHttpRouteIfNeeded(endpointInsight.route);
}







