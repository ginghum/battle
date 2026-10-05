// Run the actual inline combat engine without drawing. Native effects are stubbed;
// damage, motion, skills, simulated timers and victory rules remain unchanged.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const [htmlPath = path.join(__dirname, '..', 'index.html'), output = '/tmp/balance-results.json', trialsArg = '400', seedArg = '20261005'] = process.argv.slice(2);
const trials = Number(trialsArg), seed = Number(seedArg);
let source = fs.readFileSync(htmlPath, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const marker = '                if (SUPPORT_SKILLS.includes(this.skill) && !this.isMinion) {';
if (!source.includes(marker)) throw Error('Cannot locate base-stat initialization');
source = source.replace(marker, `                if (!this.isMinion) { this.atk = 16; this.maxHp = 1200; this.speed = 5.5; }\n${marker}`);
function element() { return {style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},children:[],firstChild:{textContent:''},appendChild(){},addEventListener(){},remove(){},querySelector(){return element();},setAttribute(){},clientWidth:1000,clientHeight:1000}; }
const math = Object.create(Math);
const context = vm.createContext({console, Math:math, document:{getElementById:()=>element(),createElement:element,addEventListener(){}},window:{addEventListener(){}},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},alert(){},headlessElement:element});
vm.runInContext(source,context);
vm.runInContext(`
showFloatingText = () => {};
createEffect = () => headlessElement();
updateGameTimeDisplay = () => {};
updateAliveCount = () => {};
updateListOrder = () => {};
Character.prototype.createDOM = function() { this.element = headlessElement(); };
Character.prototype.createListItem = function() {};
Character.prototype.updateUI = function() {};
Character.prototype.updatePosition = function() {};
let trialWinner = null;
finishGame = winner => { trialWinner = winner ? winner.teamId : null; isPlaying = false; };
const pool = SKILLS.filter(s => s.id !== 'none');
const aggregate = Object.fromEntries(pool.map(s => [s.id, {name:s.name, entries:0,wins:0,top5:0,draws:0,survivalSeconds:0}]));
let totalDraws = 0;
function runTrial(seed) {
 Math.random = mulberry32(seed);
 const skills = [...pool];
 for (let i = skills.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [skills[i],skills[j]]=[skills[j],skills[i]]; }
 characters=[];gameObjects=[];zones=[];customStats.clear();simulationTimers.clear();charIdCounter=0;gameTime=0;
 currentBattlefieldRadius=BATTLEFIELD_SIZE/2;initialTeamCount=20;isSuddenDeath=false;hasFirstDeathOccurred=false;globalSpikesActive=false;
 timeStopState={active:false,ownerTeam:null,endTime:0};timeSlowState={active:false,ownerTeam:null,endTime:0};trialWinner=null;isPlaying=true;ui.battlefieldBg=headlessElement();
 for(let i=0;i<20;i++) { const c=new Character('P'+i,Math.random,false,null,skills[i].id);c.createDOM();characters.push(c); }
 const starters=[...characters]; const extinct=new Map();const bestRemaining=new Map(starters.map(c=>[c.teamId,20]));
 for(let f=0;f<5400&&isPlaying;f++) {
  gameLoop();
  const alive=new Set(characters.filter(c=>c.isAlive&&(!c.isMinion||c.isFragment)).map(c=>c.teamId));
  for(const c of starters) {
   if(alive.has(c.teamId)) bestRemaining.set(c.teamId,alive.size);
   else if(!extinct.has(c.teamId)) extinct.set(c.teamId,gameTime/1000);
  }
  if(characters.some(c=>![c.x,c.y,c.hp].every(Number.isFinite))) throw Error('Invalid combat state at seed '+seed);
 }
 const draw=trialWinner===null;if(draw)totalDraws++;
 for(const c of starters) { const a=aggregate[c.skill];a.entries++;a.wins+=trialWinner===c.teamId?1:0;a.top5+=bestRemaining.get(c.teamId)<=5?1:0;a.draws+=draw?1:0;a.survivalSeconds+=extinct.get(c.teamId)??gameTime/1000; }
 return {seconds:gameTime/1000,draw};
}
`,context);
const start=Date.now();
for(let i=0;i<trials;i++){
 context.trialSeed = seed + i * 7919;
 vm.runInContext('runTrial(trialSeed)',context);
 if((i+1)%25===0)console.log(JSON.stringify({completed:i+1,trials,elapsedSeconds:Math.round((Date.now()-start)/1000)}));
}
const data=JSON.parse(vm.runInContext(`JSON.stringify({trials:${trials},seed:${seed},baseStats:{atk:16,hp:1200,speed:5.5},timeLimitSeconds:90,totalDraws,skills:aggregate})`,context));
for(const row of Object.values(data.skills)) {
 const n=row.entries,p=row.wins/n,z=1.96,den=1+z*z/n;
 const center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
 row.winRate=p;row.winInterval95=[Math.max(0,center-half),Math.min(1,center+half)];row.top5Rate=row.top5/n;row.meanSurvivalSeconds=row.survivalSeconds/n;
}
fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({output,totalDraws:data.totalDraws,elapsedSeconds:Math.round((Date.now()-start)/1000),weakest:Object.entries(data.skills).sort((a,b)=>a[1].winRate-b[1].winRate||a[1].top5Rate-b[1].top5Rate).slice(0,18).map(([id,a])=>({id,...a}))}));
