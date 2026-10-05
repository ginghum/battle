// npm install --no-save jsdom; node scripts/test-effect-lifecycle.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), {url:'https://battle.test/', runScripts:'outside-only'});
const w = dom.window;
w.requestAnimationFrame = () => 1;
w.cancelAnimationFrame = () => {};
w.setTimeout = () => 1;
w.clearTimeout = () => {};
w.alert = () => {};
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], dom.getInternalVMContext());
const results = vm.runInContext(`(${function () {
    function start() {
        ui.nameInput.value = Array.from({length:60}, (_,i) => 'Player'+i).join(',');
        updateInputStatus(); ui.startBtn.click(); stopLoop();
        for (const c of characters) { c.skill='none'; c.atk=0; c.hp=c.maxHp=1e9; }
    }
    const output = [];
    for (const speed of [0.5,1,2,4]) {
        start(); playbackSpeed=speed; frameTime=0;
        const beam=createEffect('beam-effect',0,0,'',600);
        const slash=createEffect('slash-effect',0,0,'',200);
        const spin=createEffect('tornado-effect',0,0,'',TICK_RATE*2);
        showFloatingText(0,0,'test','');
        // Drive the actual playback loop while wall-clock timers never fire.
        for (let timestamp=100; gameTime<1100; timestamp+=100) animationFrame(timestamp);
        const expired=!beam.isConnected && !slash.isConnected && !spin.isConnected && !ui.battlefield.querySelector('.damage-text');
        // 60 per-tick effects, repeated without giving native timers a turn.
        let peak=0;
        for (let frame=0;frame<120;frame++) {
            for(let i=0;i<60;i++) createEffect('tornado-effect',i,0,'',TICK_RATE*2);
            gameLoop(); peak=Math.max(peak,visualEffects.size);
        }
        const stressBounded=peak<=180;
        for(let i=0;i<2000;i++)createEffect('beam-effect',0,0,'',3000);
        const capped=visualEffects.size===MAX_VISUAL_EFFECTS;
        const frozen=createEffect('beam-effect',0,0,'',100);
        timeStopState={active:true,ownerTeam:characters[0].teamId,endTime:gameTime+1000};
        for(let i=0;i<7;i++)gameLoop();
        const timeStopCleanup=!frozen.isConnected;
        isPlaying=false;
        const paused=createEffect('slash-effect',0,0,'',200);
        const pausedTime=gameTime;
        for(let i=0;i<30;i++)gameLoop();
        const pausePreserved=paused.isConnected && gameTime===pausedTime;
        isPlaying=true;timeStopState.active=false;
        for(let i=0;i<13;i++)gameLoop();
        const resumeExpired=!paused.isConnected;
        const gate=new WarpGate(0,0,100,100,10000,characters[0].teamId);
        gameObjects.push(gate);
        gameObjects.push(new Tornado(0,0,characters[0].teamId,0));
        gameObjects.push(new Bomb(0,0,characters[0].teamId,0));
        zones.push(new WallZone(0,0,20,characters[0].teamId,10000));
        const persistentPresent=gate.el1.isConnected && gate.el2.isConnected;
        const winner=characters[0];finishGame(winner);
        const finishedClean=visualEffects.size===0 && !ui.battlefield.querySelector('.beam-effect,.slash-effect,.tornado-effect,.zone,.projectile,.damage-text');
        const winnerPreserved=winner.element.isConnected;
        start();createEffect('beam-effect',0,0,'',3000);ui.stopBtn.click();
        const stoppedClean=visualEffects.size===0 && !ui.battlefield.querySelector('.beam-effect');
        start();createEffect('beam-effect',0,0,'',3000);prepareGame();
        const restartClean=visualEffects.size===0 && !ui.battlefield.querySelector('.beam-effect');
        ui.stopBtn.click();
        output.push({speed,expired,peak,stressBounded,capped,timeStopCleanup,pausePreserved,resumeExpired,persistentPresent,finishedClean,winnerPreserved,stoppedClean,restartClean});
    }
    return output;
}.toString()})()`, dom.getInternalVMContext());
for (const result of results) for (const [key,value] of Object.entries(result)) if(typeof value==='boolean')assert.equal(value,true,`${result.speed}x ${key}`);
console.log(JSON.stringify({passed:true,results:Array.from(results)}));
dom.window.close();
