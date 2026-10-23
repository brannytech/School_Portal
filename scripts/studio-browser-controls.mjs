// Navigate the visible ribbon before operating a control in older workflow suites.
export function studioAction(page,name){
 const locator=page.locator(`[data-studio="${name}"]`).first();
 return {click:async options=>{
  if(!await locator.isVisible()){
   const tab=['load','reload','blank-template','new-lesson','history'].includes(name)?'File':['undo','redo','text-bold','text-italic','text-underline','up','down','duplicate','remove'].includes(name)?'Home':['insert','insert-template','text-inline-equation','text-link'].includes(name)?'Insert':name==='check-ready'?'Review':null;
   if(tab)await page.getByRole('tab',{name:tab,exact:true}).click();
   if(name==='insert-template'){const saved=page.locator('.studio-saved-items');if(!await saved.evaluate(el=>el.open))await saved.locator('summary').click();}
  }
  await locator.click(options);
 }};
}
export async function studioTab(page,name){await page.getByRole('tab',{name,exact:true}).click();}
