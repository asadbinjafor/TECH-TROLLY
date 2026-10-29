// Run with the supported CUA browser session against the explicitly isolated browser fixture.
// No production data reset, hidden browser state, direct page evaluation, or external browser driver.
export async function runWebAcceptance(tab) {
  if (!(await tab.url()).startsWith('http://localhost:3101/')) throw new Error('Use only the isolated browser-test server on port 3101.');
  const pw=tab.playwright;
  const button=name=>pw.getByRole('button',{name,exact:true});
  const field=name=>pw.getByRole('textbox',{name,exact:true});
  const option=async(name,prefix)=>{const combo=pw.getByRole('combobox',{name,exact:true});const labels=await combo.getByRole('option').allTextContents({});const label=labels.find(x=>x.startsWith(prefix));if(!label)throw new Error('Missing option '+prefix);await combo.selectOption({label});};
  await pw.getByRole('combobox',{name:/Language|ভাষা/,exact:true}).selectOption('en');
  await tab.goto('http://localhost:3101/');
  await pw.getByRole('heading',{name:"Today's overview",exact:true}).waitFor({state:'visible'});
  if(await button('Set opening balances').count()){
    await button('Set opening balances').click();await field('Opening cash').fill('100000');await field('Opening bank').fill('50000');await button('Review before posting').click();await button('Confirm and post').click();await pw.getByRole('dialog',{name:'Set opening balances',exact:true}).waitFor({state:'hidden'});
  }
  const suffix=String(Date.now()),supplier='E2E supplier '+suffix,model='E2E phone '+suffix,imei=('99'+suffix).slice(-15).padStart(15,'0');
  await pw.getByRole('link',{name:'Money & dues',exact:true}).click();await pw.getByRole('heading',{name:'Money & dues',exact:true}).waitFor({state:'visible'});await button('Add party').click();await field('Name').fill(supplier);await pw.getByRole('combobox',{name:'Type',exact:true}).selectOption('supplier');await button('Save').click();await pw.getByRole('dialog',{name:'Add party',exact:true}).waitFor({state:'hidden'});
  await pw.getByRole('link',{name:'Purchases',exact:true}).click();await pw.getByRole('heading',{name:'Purchases',exact:true}).waitFor({state:'visible'});await button('New purchase').click();await field('Model').fill(model);await field('Brand').fill('Isolated test');await field('IMEI · exactly 15 digits').fill(imei);await option('Supplier',supplier);await field('Purchase cost').fill('100');await field('Procurement / courier cost').fill('5');await field('Purchase amount paid').fill('100');await button('Review before posting').click();await button('Confirm and post').click();await pw.getByRole('dialog',{name:'New purchase',exact:true}).waitFor({state:'hidden'});
  await tab.goto('http://localhost:3101/inventory');await pw.getByRole('heading',{name:'Inventory',exact:true}).waitFor({state:'visible'});await button('New sale').all().then(items=>items[0].click());await option('Exact stock unit',model);await field('Selling price').fill('110');await field('Discount').fill('0');await field('Cash received').fill('110');await field('Bank received').fill('0');await button('Cancel').click();await button('New sale').all().then(items=>items[0].click());
  const draft=await pw.domSnapshot();if(!draft.includes('110'))throw new Error('Sale draft was lost');await button('Review before posting').click();await button('Confirm and post').click();await pw.getByRole('heading',{name:'Receipt',exact:true}).waitFor({state:'visible'});const receipt=await pw.domSnapshot();if(!receipt.includes(imei)||!receipt.includes(model)||receipt.includes('Sold-item cost'))throw new Error('Receipt snapshot invalid');
  await button('Close').click();await button('Stock out').click();const stock=await pw.domSnapshot();if(!stock.includes(imei)||!stock.includes('Sold'))throw new Error('Sold unit missing from permanent history');
  return {passed:true,model,imei,steps:['opening guard','supplier','purchase','stock','sale draft','sale','authorized receipt','stock-out history']};
}
