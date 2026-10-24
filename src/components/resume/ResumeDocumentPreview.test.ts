// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ResumeDocumentPreview} from "./ResumeDocumentPreview";
import type {ResumeBlock} from "../../services/types";
vi.mock("../../context/ThemeContext",()=>({useTheme:()=>({preference:"light"})}));
const block:ResumeBlock={block_id:"block",text:"SQL 프로젝트",text_hash:"a".repeat(64),page:1,source_node_id:"p1"};
let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it("keeps document selection and Ctrl zoom working after native annotations are highlighted",async()=>{
 const select=vi.fn(),zoom=vi.fn();
 await act(async()=>root.render(createElement(ResumeDocumentPreview,{html:"<p>SQL 프로젝트</p>",blocks:[block],selected:block,zoom:100,onZoom:zoom,onSelect:select})));
 const iframe=host.querySelector("iframe")!,doc=iframe.contentDocument!;
 doc.body.innerHTML='<section class="document-page"><p data-node-id="p1"><mark data-label="resume-block:block">SQL 프로젝트</mark></p></section>';
 await act(async()=>iframe.dispatchEvent(new Event("load")));
 expect(doc.querySelector('[data-resume-selectable]')).not.toBeNull();
 await act(async()=>doc.querySelector<HTMLElement>('mark[data-label]')!.click());
 expect(select).toHaveBeenCalledWith(block);
 const event=new WheelEvent("wheel",{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true});
 await act(async()=>doc.body.dispatchEvent(event));
 expect(event.defaultPrevented).toBe(true);expect(zoom).toHaveBeenLastCalledWith(110);
 const ordinary=new WheelEvent("wheel",{deltaY:100,bubbles:true,cancelable:true});
 await act(async()=>doc.body.dispatchEvent(ordinary));expect(ordinary.defaultPrevented).toBe(false);
});
