import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,preset,obstacles,flags,pickups,checkpoints,hazards,
 freshRoom,addPlayer,beginParty,tick,TOTAL_CHALLENGES} from '../lib/party.js';
function runFor(g,seconds,controls={}){
 for(let n=0;n<Math.ceil(seconds/.1);n++)g=tick(g,controls,.1);
 return g;
}
test('all 300 catalog entries cover 12 mechanics / 25 variants',()=>{
 assert.equal(catalog.length,300);assert.equal(new Set(catalog.map(c=>c.id)).size,300);
 assert.equal(new Set(catalog.map(c=>c.name)).size,300);
 assert.equal(new Set(catalog.map(c=>c.mode)).size,12);
 assert.equal(new Set(catalog.map(c=>c.variant)).size,25);
 for(let i=0;i<300;i++){
  const p=preset(i);assert.equal(p.number,i+1);
  assert.ok(p.duration>=55&&p.duration<=87);
  assert.ok(obstacles(i).length<=6);
  assert.equal(checkpoints(i).length,6);assert.equal(flags(i).length,3);
 }
 assert.equal(preset(300).id,0);assert.equal(TOTAL_CHALLENGES,300);
});
test('lobby → countdown → playing → results → next round',()=>{
 let g=addPlayer(freshRoom('host','Host'),'friend','Friend');
 g=beginParty(g);assert.equal(g.phase,'countdown');
 g=runFor(g,3.2);assert.equal(g.phase,'playing');
 g=runFor(g,preset(g.challenge).duration+.2);assert.equal(g.phase,'results');
 g=runFor(g,5.2);assert.equal(g.phase,'countdown');
 assert.equal(g.round,2);
});
test('movement bounds and deterministic hazards',()=>{
 let g=addPlayer(freshRoom('host','Host'),'bot-1','Bot');
 g=beginParty({...g,selection:29});g=runFor(g,3.2);
 g=runFor(g,18,{host:{x:1,z:1}});
 assert.ok(g.players.every(p=>Math.abs(p.x)<=11.2&&Math.abs(p.z)<=11.2));
 assert.deepEqual(hazards(29,8),hazards(29,8));
 assert.deepEqual(pickups(12,3),pickups(12,3));
});
test('scoring rewards winner and ends party with champion',()=>{
 let g=addPlayer(freshRoom('host','Host'),'friend','Friend');
 g={...g,phase:'playing',round:5,maxRounds:5,challenge:1,elapsed:1,remaining:.02,
  players:g.players.map((p,i)=>({...p,score:i?0:20}))};
 g=runFor(g,.2);assert.equal(g.phase,'results');
 assert.ok(g.players[0].points>g.players[1].points);
 g=runFor(g,5.2);assert.equal(g.phase,'podium');assert.equal(g.winner,'host');
});

test('double jump starts on separate input sequence taps and lands safely',()=>{
 let g=addPlayer(freshRoom('host','Host'),'friend','Friend');
 g=beginParty({...g,selection:4});
 g=runFor(g,3.2);
 const normalY=g.players[0].y;
 g=tick(g,{host:{x:0,z:0,jump:false,jumpId:1}},.1);
 assert.ok(g.players[0].y>normalY);
 assert.equal(g.players[0].jumpsLeft,1);
 const firstY=g.players[0].y;
 g=tick(g,{host:{x:0,z:0,jump:false,jumpId:1}},.1);
 assert.equal(g.players[0].jumpsLeft,1,'replayed jump packet cannot trigger another jump');
 g=tick(g,{host:{x:0,z:0,jump:false,jumpId:2}},.1);
 assert.equal(g.players[0].jumpsLeft,0);
 assert.ok(g.players[0].y>firstY,'second tap adds upward movement');
 g=runFor(g,2,{host:{x:0,z:0,jump:false,jumpId:2}});
 assert.equal(g.players[0].y,0);
 assert.equal(g.players[0].jumpsLeft,2);
 g=tick(g,{host:{x:0,z:0,jump:false,jumpId:3}},.1);
 assert.ok(g.players[0].y>0,'player can jump again after landing');
});
test('full 300 challenge catalog simulates without nonfinite positions',()=>{
 for(let challenge=0;challenge<300;challenge++){
  let g=addPlayer(freshRoom('host','Host'),'bot-1','Bot');
  g=beginParty({...g,selection:challenge});g=runFor(g,3.2);
  assert.equal(g.phase,'playing');
  g=runFor(g,preset(challenge).duration+.2,{host:{x:1,z:1,jumpId:1}});
  assert.equal(g.phase,'results', 'challenge '+challenge);
  assert.ok(g.players.every(p=>[p.x,p.z,p.y,p.score,p.points].every(Number.isFinite)));
 }
});
