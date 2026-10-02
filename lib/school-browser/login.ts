import type { Page } from "playwright-core";
import { CollectorError } from "./config";
const allowed={classroom:new Set(["https://accounts.google.com","https://classroom.google.com"]),genesis:new Set(["https://parents.c3.genesisedu.net"])};
const origin=(page:Page)=>new URL(page.url()).origin;
async function challenge(page:Page){
  const text=await page.locator("body").innerText({timeout:10000}).catch(()=>"");
  if(/captcha|verify (?:that )?you(?:'re| are) human|2-step verification|verify it.s you|enter (?:the |a )?(?:verification |security )?code|browser or app may not be secure|couldn.t sign you in|access (?:blocked|denied)|administrator.*(?:review|block)|account.*(?:disabled|locked)/i.test(text))
    throw new CollectorError("The login requires verification or is restricted. Complete the normal login manually or contact the school; the collector will not bypass this step.");
  if(await page.locator('input[autocomplete="one-time-code"]:visible,iframe[title*="CAPTCHA" i]:visible').count())throw new CollectorError("MFA or CAPTCHA requires manual sign-in. Automatic collection stopped.");
}
async function validateDestination(page:Page,input:ReturnType<Page["locator"]>,service:keyof typeof allowed){
  const action=await input.evaluate(el=>{const form=(el as HTMLInputElement).form;return form ? new URL(form.getAttribute("action")||location.href,location.href).href : location.href;});
  if(!allowed[service].has(new URL(action).origin))throw new CollectorError("The login form redirects credentials to an unrecognized service. Automatic sign-in stopped.");
}
async function submit(page:Page,input:ReturnType<Page["locator"]>,service:keyof typeof allowed){
  await validateDestination(page,input,service);
  const form=input.locator("xpath=ancestor::form");
  const root=await form.count()===1?form:page.locator("body");
  const button=root.getByRole("button",{name:/^(Next|Sign in|Log in|Login|Continue)$/i}).filter({visible:true});
  if(await button.count()!==1)throw new CollectorError("The login page does not have one clearly labeled sign-in/next button. Complete sign-in manually.");
  await button.click({timeout:10000});
}
// Discover normal rendered form controls at runtime. No speculative auth endpoint,
// copied session, stealth flags, cookie export, or credential retry loop is used.
export async function signIn(page:Page,service:keyof typeof allowed,credentials:{username:string;password:string},studentIds:string[]=[]){
  let enteredUsername=false,enteredPassword=false,followedLanding=false;
  const target=service==="classroom"?"https://classroom.google.com/":"https://parents.c3.genesisedu.net/leonia/parents";
  const response=await page.goto(target,{waitUntil:"domcontentloaded",timeout:45000});
  const initialStatus=response?.status();
  const verification=response?.headers()["x-amzn-waf-action"];
  if(verification==="captcha"||verification==="challenge")throw new CollectorError("The school website requires browser verification before sign-in. Cloud refresh stopped without submitting credentials. Contact the school or portal support to permit cloud access.");
  for(let attempt=0;attempt<35;attempt++){
    if(service==="classroom" && origin(page)==="https://edu.google.com" && !followedLanding){
      const links=await page.locator("a[href]:visible").evaluateAll(nodes=>nodes.map(n=>({text:(n as HTMLElement).innerText.trim(),href:(n as HTMLAnchorElement).href})));
      const link=links.find(l=>/sign in|go to classroom/i.test(l.text)&&["https://classroom.google.com","https://accounts.google.com"].includes(new URL(l.href).origin));
      if(!link)throw new CollectorError("Google's education landing page has no recognized visible Classroom sign-in link. No credentials entered.");
      followedLanding=true;await page.goto(link.href,{waitUntil:"domcontentloaded",timeout:45000});continue;
    }
    if(!allowed[service].has(origin(page)))throw new CollectorError("Login reached another identity provider. Automatic sign-in stopped; its normal login flow must be inspected first. Destination: " + origin(page));
    await challenge(page);
    if(service==="classroom" && origin(page)==="https://classroom.google.com" && await page.locator('[aria-label*="Google Account:"],[title*="Google Account:"]').count())return;
    const passwords=page.locator('input[type="password"]:visible');
    const emails=page.locator('input[type="email"]:visible,input[autocomplete="username"]:visible').or(page.getByRole("textbox",{name:/email|phone|username/i})).filter({visible:true});
    const texts=page.locator('input[type="text"]:visible');
    const username=await emails.count()===1?emails:service==="genesis"&&await texts.count()===1?texts:null;
    if(service==="genesis" && enteredPassword && !await passwords.count()){
      const logout=page.getByText(/^(Log ?out|Sign out)$/i).filter({visible:true});
      if(await logout.count()===1)return;
      const links=await page.locator("a[href]:visible").evaluateAll(nodes=>nodes.map(n=>(n as HTMLAnchorElement).href));
      if(links.some(link=>{try{const url=new URL(link);return url.origin===origin(page)&&studentIds.includes(url.searchParams.get("studentid")||"");}catch{return false;}}))return;
    }
    if(!enteredUsername && username){
      await validateDestination(page,username,service);
      await username.fill(credentials.username,{timeout:10000});enteredUsername=true;
      if(await passwords.count()===1){await validateDestination(page,passwords,service);await passwords.fill(credentials.password,{timeout:10000});enteredPassword=true;await submit(page,passwords,service);}
      else await submit(page,username,service);
    }else if(!enteredPassword && enteredUsername && await passwords.count()===1){
      if(service==="classroom"){
        const body=await page.locator("body").innerText();
        if(!body.toLowerCase().includes(credentials.username.toLowerCase()))throw new CollectorError("The Google password page does not show the expected student account. Sign-in stopped.");
      }
      await validateDestination(page,passwords,service);
      await passwords.fill(credentials.password,{timeout:10000});enteredPassword=true;await submit(page,passwords,service);
    }
    await page.waitForTimeout(500);
  }
  // Only fixed boolean diagnostics: never log page text, inputs, account names or URLs.
  const checks=await page.evaluate(()=>({methodRejected:/405|method not allowed/i.test(document.body.innerText),credentialsRejected:/incorrect password|invalid (?:username|password|login)|login failed/i.test(document.body.innerText),passwordVisible:[...document.querySelectorAll('input[type="password"]')].some(e=>e.getClientRects().length>0),loginControlVisible:[...document.querySelectorAll('input[type="text"],input[type="email"]')].some(e=>e.getClientRects().length>0)}));
  const structure=await page.evaluate(()=>({bodyLength:document.body.innerText.length,inputCount:document.querySelectorAll("input").length,frameCount:document.querySelectorAll("iframe,frame").length,maintenance:/maintenance|temporarily unavailable/i.test(document.body.innerText),javascriptRequired:/enable javascript|javascript is required/i.test(document.body.innerText)}));
  console.info("School login outcome",{service,initialStatus,enteredUsername,enteredPassword,...checks,...structure});
  if(initialStatus && initialStatus>=400 && !enteredUsername)throw new CollectorError(`The school website returned HTTP ${initialStatus} before sign-in. No credentials were submitted. Contact the school or portal support to permit cloud access.`);
  if(checks.methodRejected)throw new CollectorError("The school server rejected the login request. Previous data is preserved.");
  if(checks.credentialsRejected)throw new CollectorError("The school rejected the saved login. Update the server credentials before refreshing again.");
  throw new CollectorError("Automatic sign-in did not complete. Check the saved credentials and the school's normal login page. No password retry was attempted.");
}
