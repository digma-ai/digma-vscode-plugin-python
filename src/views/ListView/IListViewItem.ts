import { UsageStatusResults } from "../../services/analyticsProvider";
import { CodeObjectGroupEnvironments } from "../codeAnalytics/CodeObjectGroups/CodeObjectGroupEnvUsage";
import { IListGroupItemBase } from "./IListViewGroupItem";

export function sort(items: IListViewItemBase []): IListViewItemBase [] 
{
    return items.sort((a,b)=>(a.sortIndex === undefined ? 0: a.sortIndex) - (b.sortIndex === undefined ? 0: b.sortIndex));
}
export interface IListViewItemBase
{
    sortIndex: number| undefined;
    getHtml(): string | undefined;
    groupId: string | undefined;
}

export interface IListViewItem extends IListViewItemBase
{

}

export interface IItemsInGroup extends IListViewItemBase
{
    groupId: string;
    addItems(...items: IListViewItem []): void;
    getItems() : IListViewItem [];
}

export class InsightItemGroupRendererFactory {

    public constructor( private emptyGroupItemtemplate: IListViewItemBase, private codeObjectEnvironments : CodeObjectGroupEnvironments,
        private usageResults: UsageStatusResults){}

    public getRenderer(group: IListGroupItemBase, sortIndex: number|undefined = undefined): InsightListGroupItemsRenderer{
        return new InsightListGroupItemsRenderer(group,sortIndex,this.emptyGroupItemtemplate,this.codeObjectEnvironments,this.usageResults);

    }
}

export class InsightListGroupItemsRenderer implements IItemsInGroup
{
    private _items: IListViewItem [] = [];

    constructor(public group: IListGroupItemBase, public sortIndex: number|undefined = undefined,
        private emptyGroupItemtemplate: IListViewItemBase, private codeObjectEnvironments : CodeObjectGroupEnvironments,
        private usageResults: UsageStatusResults)
    {
        this.groupId=group.groupId;
    }
    groupId: string;
    
    getItems(): IListViewItem[] {
        return this._items;
    }
    addItems(...items: IListViewItem []){
        this._items.push(...items);
    }
    public getHtml(): string | undefined
    {
        let html='';

        if (this._items.length>0){
            html = sort(this._items)
                    .map(o=>o.getHtml())
                    .filter((o)=>o)
                    .join("");
                    
        }
        else{
            html+=this.emptyGroupItemtemplate.getHtml();
        }

        //+ this.codeObjectEnvironments.getUsageHtml(this.group.groupId, this.group.type, this.usageResults )
        return this.group.getHtml()  + html;
    }
}

