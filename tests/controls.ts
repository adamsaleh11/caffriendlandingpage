import {expect,type Locator,type Page} from '@playwright/test';

/** The shadcn controls are buttons with a portalled listbox, not native fields. */
/** Opens a shadcn Select and returns its listbox, for assertions on the options. */
export async function openSelect(control:Locator){
 const page=control.page();
 const trigger=await control.elementHandle();
 if(!trigger) throw new Error('The select trigger was not found.');
 const list=page.locator('[data-slot="select-content"]').last();
 for(let attempt=0;attempt<3;attempt+=1){
  if(await trigger.getAttribute('data-state')==='open') break;
  await trigger.click();
  await page.waitForTimeout(200);
 }
 await expect(list).toBeVisible();
 return list;
}

export async function chooseOption(control:Locator,option:{label?:string;index?:number;value?:string}){
 const page=control.page();
 // While the listbox is open Radix hides everything outside it from the
 // accessibility tree — the trigger included — so it is held as a DOM handle
 // rather than re-queried by role, and a synthetic pointer pair can land as
 // open-then-close, so the open state is asserted rather than assumed.
 const trigger=await control.elementHandle();
 if(!trigger) throw new Error('The select trigger was not found.');
 const list=page.locator('[data-slot="select-content"]').last();
 for(let attempt=0;attempt<3;attempt+=1){
  if(await trigger.getAttribute('data-state')==='open') break;
  await trigger.click();
  await page.waitForTimeout(200);
 }
 await expect(list).toBeVisible();
 const item=option.label!==undefined
  ? list.getByRole('option',{name:option.label,exact:true})
  : option.value!==undefined
   ? list.getByRole('option',{name:option.value,exact:true})
   : list.getByRole('option').nth(option.index??0);
 await item.click();
 await expect(list).toBeHidden();
}

export async function chooseSelect(page:Page,name:string|RegExp,option:{label?:string;index?:number;value?:string}){
 await chooseOption(page.getByRole('combobox',{name}),option);
}

/** Drives the popover calendar to an ISO `YYYY-MM-DD`. */
export async function chooseDate(control:Locator,iso:string){
 const page=control.page();
 await control.click();
 const grid=page.locator('[data-slot="popover-content"]').last();
 await expect(grid).toBeVisible();
 const cell=grid.locator(`td[data-day="${iso}"] button`);
 for(let step=0;step<48&&!await cell.count();step+=1) await grid.getByRole('button',{name:/next/i}).click();
 await cell.click();
 await expect(grid).toBeHidden();
}

/** Drives the popover time columns to a 24-hour `HH:mm`. */
export async function chooseTime(control:Locator,value:string){
 const page=control.page();
 const [rawHour,minute]=value.split(':');
 const hour24=Number(rawHour);
 const hour=hour24%12===0?12:hour24%12;
 const meridiem=hour24<12?'AM':'PM';
 await control.click();
 const popover=page.locator('[data-slot="popover-content"]').last();
 await expect(popover).toBeVisible();
 const columns=popover.getByRole('listbox');
 await columns.nth(0).getByRole('option',{name:String(hour),exact:true}).click();
 await columns.nth(1).getByRole('option',{name:minute,exact:true}).click();
 await columns.nth(2).getByRole('option',{name:meridiem,exact:true}).click();
 await control.click();
 await expect(popover).toBeHidden();
}

/** The old `datetime-local` fields are now a date popover beside a time popover. */
export async function setDateTime(page:Page,label:string,iso:string,time:string){
 await chooseDate(page.getByRole('button',{name:`${label} date`}),iso);
 await chooseTime(page.getByRole('button',{name:`${label} time`}),time);
}
