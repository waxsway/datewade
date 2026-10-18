import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,preset,obstacles,flags,pickups,checkpoints,hazards,
 freshRoom,addPlayer,beginParty,tick,TOTAL_CHALLENGES} from '../lib/party.js';

function advance(state,seconds,inputs={}){
 let g=state, t=0;
 while(t<seconds){
   const dt=Math.min(.1,seconds-t);
   g=tick(g,inputs,dt);
   t+=dt;
 }
 return g;
}

test('catalog has 300 distinct stage + rule combinations',()=>{
 assert.equal(catalog.length,300);
 assert.equal(new Set(catalog.map(g=>g.id)).size,300);
 assert.equal(new Set(catalog.map(g=>g.name)).size,300);
 assert.equal(new Set(catalog.map(g=>g.mode)).size,12);
 assert.equal(new Set(catalog.map(g=>g.variant)).size,25);
 assert.equal(TOTAL_CHALLENGES,300);
 for(let i=0;i<300;i++){
  const p=preset(i);
  assert.equal(p.number,i+1);
  assert.ok(p.duration>=21&&p.duration<=29);
  assert.ok(obstacles(i).length<=6);
  assert.equal(checkpoints(i).length,6);
  assert.equal(flags(i).length,3);
 }
 assert.equal(preset(300).id,0);
});

test('lobby/countdown/play/results/next round loop',()=>{
 let g=freshRoom('host','Host');
 g=addPlayer(g,'friend','Friend');
 assert.equal(g.players.length,2);
 g=beginParty(g);assert.equal(g.phase,'countdown');
 g=advance(g,3.1);assert.equal(g.phase,'playing');
 g=advance(g,30);assert.equal(g.phase,'results');
 g=advance(g,5.1);assert.equal(g.phase,'countdown');
 assert.equal(g.round,2);
});

test('position bounds and seeded hazards and pickups',()=>{
 let g=addPlayer(freshRoom('host','Host'),'bot-1','Bot');
 g=beginParty({...g,selection:29});
 g=advance(g,3.1);
 for(let i=0;i<120;i++)g=tick(g,{host:{x:1,z:1}},.1);
 assert.ok(g.players.every(p=>Math.abs(p.x)<=11.2&&Math.abs(p.z)<=11.2));
 assert.deepEqual(hazards(29,8),hazards(29,8));
 assert.deepEqual(pickups(12,3),pickups(12,3));
});

test('final round awards points and declares champion',()=>{
 let g=addPlayer(freshRoom('host','Host'),'friend','Friend');
 g={...g,phase:'playing',round:5,remaining:.01,
  players:g.players.map((p,i)=>({...p,score:i?0:15}))};
 g=tick(g,{},.1);
 assert.equal(g.phase,'results');
 assert.ok(g.players[0].points>g.players[1].points);
 g=advance(g,5.1);
 assert.equal(g.phase,'podium');
 assert.equal(g.winner,'host');
});
