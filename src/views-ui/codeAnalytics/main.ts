import { ITab } from "./tabs/baseTab";
import { ErrorsTab } from "./tabs/errors";

let tabs:ITab[] = [];

window.addEventListener("load", () => 
{
    tabs.push(new ErrorsTab('tab-errors', '#view-errors'));

    for(let tab of tabs)
        tab.init();

    $('.analytics-nav').on('change', e => 
    {
        if(e.target == $('.analytics-nav')[0])
            activateTab((<any>e.originalEvent).detail.id)
    });
    activateTab($('.analytics-nav').attr('activeid'))
});

function activateTab(tabId?: string){
    for(let tab of tabs){
        if(tab.tabId == tabId)
            tab.activate();
        else
            tab.deactivate();
    }
}