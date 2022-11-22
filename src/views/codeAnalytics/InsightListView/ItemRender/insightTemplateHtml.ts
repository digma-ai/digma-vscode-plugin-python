import * as vscode from 'vscode';
import { WebViewUris } from './../../../webViewUtils';
import { Insight, CodeObjectInsight } from './../IInsightListViewItemsCreator';

export interface IInsightTemplateData{
    title: string | ITitle,
    description?: string,
    icon?: vscode.Uri,
    body?: string,
    buttons?: string[],
    insight?: Insight,
}

export interface ITitle{
    text: string,
    tooltip: string
}

export class InsightTemplateHtml
{

    constructor(
        public readonly data: IInsightTemplateData,
        private _viewUris: WebViewUris,
    ) {
    }

    public renderHtml():string{
        const descriptionHtml = this.data.description
            ? ` <div class="list-item-content-description">${this.data.description}</div>`
            : ``;

        const bodyHtml = this.data.body
            ? ` <div class="list-item-body">${this.data.body}</div>`
            : ``;

        const iconHtml = this.data.icon
            ? `<img class="list-item-icon" src="${this.data.icon}" width="15" height="15">`
            : ``;
        
        const { insight } = this.data;
        
        let startTime = '';
        let formattedStartTime = '';
        let hasCustomTime = false;

        const buttons = this.data.buttons || [];

        const menuItems = [];
        if((<CodeObjectInsight>insight)?.prefixedCodeObjectId) {
            const codeObjectInsight = <CodeObjectInsight>insight;
            const {
                prefixedCodeObjectId: codeObjectId,
                type: insightType,
                actualStartTime,
                customStartTime,
            } = codeObjectInsight;

            console.log('insight', codeObjectId, insightType, customStartTime);

            startTime = actualStartTime?.format('L') || '';
            formattedStartTime = actualStartTime?.fromNow() || formattedStartTime;
            hasCustomTime = !!customStartTime;
            
            const recalculateButton = `
                <div
                    class="list-item-button hover-button custom-start-date-recalculate-link"
                    data-code-object-id="${codeObjectId}"
                    data-insight-type="${insightType}"
                    title="Recalculate the insight only using new data"
                >Recalculate</div>
            `;
            buttons.push(recalculateButton);
        
            // menuItems.push(`
            //     <li
            //         class="list-item-menu-item custom-start-date-recalculate-link"
            //         data-code-object-id="${codeObjectId}"
            //         data-insight-type="${insightType}"
            //     >Recalculate</li>
            // `);
        }

        // const threeDotImageUri = this._viewUris.image('three-dots.svg');

        let menuHtml = ``;
        // let menuHtml = menuItems?.length > 0
        //     ? `<ul class="list-item-menu sf-menu sf-js-enabled">
        //         <li class="list-item-menu">
        //             <img class="list-item-icon" src="${threeDotImageUri}" height="15">
        //             <ul>
        //                 ${menuItems.join("")}
        //             </ul>
        //         </li>
        //     </ul>`
        //     : ``;
        // const menuItemsHtml = menuItems.length > 0
        //     ? `<li class="list-item-menu-item">
        //         <img class="list-item-icon" src="${threeDotImageUri}" height="15">
        //         <ul>
        //             ${menuItems.join("")}
        //         </ul>
        //     </li>`
        //     : ``;
        // const menuHtml = `
        //     <ul class="list-item-menu sf-menu sf-js-enabled">
        //         ${menuItemsHtml}
        //     </ul>`;
        
        let title = "";
        let tooltip = "";
        if(typeof this.data.title === 'string'){
            title = <string>this.data.title;
        }
        else{
            title = (<ITitle>this.data.title).text;
            tooltip = (<ITitle>this.data.title).tooltip;
        }

        const timeInfoVisibilityClass = hasCustomTime ? '' : 'hidden';
        const timeInfoHtml = `
            <div class="list-item-time-info ${timeInfoVisibilityClass}">
                <span class="list-item-time-info-message" title="${startTime}">Age of data: ${formattedStartTime}</span>
                <a href="#" class="custom-start-date-refresh-link">Refresh</a>
            </div>
        `;

        const buttonsHtml = this.data.buttons
            ? ` <div class="list-item-buttons">${this.data.buttons.join("")}</div>`
            : ``;
    
        const html = /*html*/`
            <div class="list-item insight">
                <div class="list-item-top-area">
                    <div class="list-item-header">
                        <div class="list-item-title" title="${tooltip}"><strong>${title}</strong></div>
                        ${timeInfoHtml}
                        ${descriptionHtml}
                    </div>
                    ${iconHtml}
                    ${menuHtml}
                </div>
                ${bodyHtml}
                ${buttonsHtml}
            </div>`;

        return html;
    }
}