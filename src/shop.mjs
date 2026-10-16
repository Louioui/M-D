export const SHOP={name:'M&D Multi-Service',phone:'+13233544795',email:'md_multiservice@yahoo.com',address:'419 N Boyle Ave, Los Angeles, CA 90033',timezone:'America/Los_Angeles'};
export function shopStatus(date=new Date()) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:SHOP.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
 const minutes=Number(parts.hour)*60+Number(parts.minute), saturday=parts.weekday==='Sat';
 const opens=saturday?480:510, closes=saturday?960:1080;
 const open=parts.weekday!=='Sun'&&minutes>=opens&&minutes<closes;
 return {open,label:open?'Open now':'Closed now',detail:open?`Until ${saturday?'4':'6'} PM`:'Text us anytime'};
}
export function bookingMessage(fields) {return `Hi David & Edith! I'm ${fields.name}. I'd like to request ${fields.service} for my ${fields.year} ${fields.make} ${fields.model}.${fields.message?`\n\n${fields.message}`:''}\n\nPlease let me know your availability. Thank you!`;}
export function bookingLink(channel,fields) {const body=encodeURIComponent(bookingMessage(fields));return channel==='sms'?`sms:${SHOP.phone}?body=${body}`:`mailto:${SHOP.email}?subject=${encodeURIComponent('Service request — '+fields.year+' '+fields.make+' '+fields.model)}&body=${body}`;}
