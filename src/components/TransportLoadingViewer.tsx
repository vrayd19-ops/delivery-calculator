'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import styles from './TransportLoadingViewer.module.css';
import {
  createSandwichBundles,
  calculatePanelWeightKg,
  type SandwichPanel,
} from '../lib/sandwich-panels';
import { planSandwichLoading } from '../lib/sandwich-loading';

type Side = 'LEFT' | 'RIGHT';
type BoardId = `${Side}_${string}`;
type BoardControl = {
  object: THREE.Object3D;
  angle: number;
  sign: number;
};
type StakeControl = {
  object: THREE.Object3D;
  id: string;
};
type ModelControls = {
  boards: Map<BoardId, BoardControl>;
  stakes: Map<string, StakeControl>;
  rear: { object: THREE.Object3D; angle: number } | null;
};
type DesiredState = {
  openBoards: Set<BoardId>;
  hiddenStakes: Set<string>;
  rearOpen: boolean;
  rotate: boolean;
};

type AngleStandard = 'equal' | 'unequal';
type AngleCatalogRow = {kind:AngleStandard;a:number;b:number;t:number;kgPerM:number;pack6:number;pack117:number;estimated:boolean};
// Masses from the supplied reference table are preserved.
// For newly added sizes, kg/m is an engineering estimate (sharp-corner section, steel 7850 kg/m³).
// Estimated values must be confirmed against supplier / ГОСТ before commercial use.
const ANGLE_CATALOG: readonly AngleCatalogRow[] = [
  // Равнополочные
  {kind:'equal',a:20,b:20,t:3,kgPerM:.89,pack6:936,pack117:480,estimated:false},
  {kind:'equal',a:20,b:20,t:4,kgPerM:1.15,pack6:724,pack117:371,estimated:false},
  {kind:'equal',a:25,b:25,t:3,kgPerM:1.12,pack6:744,pack117:381,estimated:false},
  {kind:'equal',a:25,b:25,t:4,kgPerM:1.46,pack6:570,pack117:292,estimated:false},
  {kind:'equal',a:28,b:28,t:3,kgPerM:1.248,pack6:667,pack117:342,estimated:true},
  {kind:'equal',a:30,b:30,t:3,kgPerM:1.342,pack6:620,pack117:318,estimated:true},
  {kind:'equal',a:30,b:30,t:4,kgPerM:1.758,pack6:474,pack117:243,estimated:true},
  {kind:'equal',a:32,b:32,t:3,kgPerM:1.46,pack6:570,pack117:292,estimated:false},
  {kind:'equal',a:32,b:32,t:4,kgPerM:1.91,pack6:436,pack117:223,estimated:false},
  {kind:'equal',a:35,b:35,t:3,kgPerM:1.60,pack6:520,pack117:267,estimated:false},
  {kind:'equal',a:35,b:35,t:4,kgPerM:2.10,pack6:396,pack117:203,estimated:false},
  {kind:'equal',a:35,b:35,t:5,kgPerM:2.551,pack6:326,pack117:167,estimated:true},
  {kind:'equal',a:40,b:40,t:3,kgPerM:1.85,pack6:450,pack117:231,estimated:false},
  {kind:'equal',a:40,b:40,t:4,kgPerM:2.42,pack6:344,pack117:176,estimated:false},
  {kind:'equal',a:40,b:40,t:5,kgPerM:2.98,pack6:279,pack117:143,estimated:false},
  {kind:'equal',a:45,b:45,t:3,kgPerM:2.049,pack6:406,pack117:208,estimated:true},
  {kind:'equal',a:45,b:45,t:4,kgPerM:2.7,pack6:308,pack117:158,estimated:true},
  {kind:'equal',a:45,b:45,t:5,kgPerM:3.336,pack6:249,pack117:128,estimated:true},
  {kind:'equal',a:50,b:50,t:3,kgPerM:2.284,pack6:364,pack117:187,estimated:true},
  {kind:'equal',a:50,b:50,t:4,kgPerM:3.05,pack6:273,pack117:140,estimated:false},
  {kind:'equal',a:50,b:50,t:5,kgPerM:3.77,pack6:221,pack117:113,estimated:false},
  {kind:'equal',a:50,b:50,t:6,kgPerM:4.47,pack6:186,pack117:95,estimated:false},
  {kind:'equal',a:56,b:56,t:4,kgPerM:3.391,pack6:245,pack117:126,estimated:true},
  {kind:'equal',a:56,b:56,t:5,kgPerM:4.2,pack6:198,pack117:101,estimated:true},
  {kind:'equal',a:63,b:63,t:4,kgPerM:3.831,pack6:217,pack117:111,estimated:true},
  {kind:'equal',a:63,b:63,t:5,kgPerM:4.81,pack6:173,pack117:88,estimated:false},
  {kind:'equal',a:63,b:63,t:6,kgPerM:5.72,pack6:145,pack117:74,estimated:false},
  {kind:'equal',a:70,b:70,t:4.5,kgPerM:4.787,pack6:174,pack117:89,estimated:true},
  {kind:'equal',a:70,b:70,t:5,kgPerM:5.299,pack6:157,pack117:80,estimated:true},
  {kind:'equal',a:70,b:70,t:6,kgPerM:6.311,pack6:132,pack117:67,estimated:true},
  {kind:'equal',a:70,b:70,t:7,kgPerM:7.308,pack6:114,pack117:58,estimated:true},
  {kind:'equal',a:70,b:70,t:8,kgPerM:8.29,pack6:100,pack117:51,estimated:true},
  {kind:'equal',a:75,b:75,t:5,kgPerM:5.80,pack6:143,pack117:73,estimated:false},
  {kind:'equal',a:75,b:75,t:6,kgPerM:6.89,pack6:120,pack117:62,estimated:false},
  {kind:'equal',a:75,b:75,t:7,kgPerM:7.858,pack6:106,pack117:54,estimated:true},
  {kind:'equal',a:75,b:75,t:8,kgPerM:9.02,pack6:92,pack117:47,estimated:false},
  {kind:'equal',a:75,b:75,t:9,kgPerM:9.962,pack6:83,pack117:42,estimated:true},
  {kind:'equal',a:80,b:80,t:5.5,kgPerM:6.671,pack6:124,pack117:64,estimated:true},
  {kind:'equal',a:80,b:80,t:6,kgPerM:7.253,pack6:114,pack117:58,estimated:true},
  {kind:'equal',a:80,b:80,t:7,kgPerM:8.407,pack6:99,pack117:50,estimated:true},
  {kind:'equal',a:80,b:80,t:8,kgPerM:9.546,pack6:87,pack117:44,estimated:true},
  {kind:'equal',a:90,b:90,t:6,kgPerM:8.33,pack6:100,pack117:51,estimated:false},
  {kind:'equal',a:90,b:90,t:7,kgPerM:9.64,pack6:86,pack117:44,estimated:false},
  {kind:'equal',a:90,b:90,t:8,kgPerM:10.802,pack6:77,pack117:39,estimated:true},
  {kind:'equal',a:90,b:90,t:9,kgPerM:12.23,pack6:68,pack117:34,estimated:false},
  {kind:'equal',a:100,b:100,t:6.5,kgPerM:9.873,pack6:84,pack117:43,estimated:true},
  {kind:'equal',a:100,b:100,t:7,kgPerM:10.79,pack6:77,pack117:39,estimated:false},
  {kind:'equal',a:100,b:100,t:8,kgPerM:12.25,pack6:68,pack117:34,estimated:false},
  {kind:'equal',a:100,b:100,t:10,kgPerM:15.10,pack6:55,pack117:28,estimated:false},
  {kind:'equal',a:100,b:100,t:12,kgPerM:17.71,pack6:47,pack117:24,estimated:true},
  {kind:'equal',a:100,b:100,t:14,kgPerM:20.441,pack6:40,pack117:20,estimated:true},
  {kind:'equal',a:100,b:100,t:16,kgPerM:23.11,pack6:36,pack117:18,estimated:true},
  {kind:'equal',a:110,b:110,t:7,kgPerM:11.704,pack6:71,pack117:36,estimated:true},
  {kind:'equal',a:110,b:110,t:8,kgPerM:13.314,pack6:62,pack117:32,estimated:true},
  {kind:'equal',a:125,b:125,t:8,kgPerM:15.46,pack6:53,pack117:27,estimated:false},
  {kind:'equal',a:125,b:125,t:9,kgPerM:17.027,pack6:48,pack117:25,estimated:true},
  {kind:'equal',a:125,b:125,t:10,kgPerM:19.10,pack6:43,pack117:22,estimated:false},
  {kind:'equal',a:125,b:125,t:12,kgPerM:22.68,pack6:36,pack117:18,estimated:false},
  {kind:'equal',a:125,b:125,t:14,kgPerM:25.936,pack6:32,pack117:16,estimated:true},
  {kind:'equal',a:125,b:125,t:16,kgPerM:29.39,pack6:28,pack117:14,estimated:true},
  {kind:'equal',a:140,b:140,t:9,kgPerM:19.146,pack6:43,pack117:22,estimated:true},
  {kind:'equal',a:140,b:140,t:10,kgPerM:21.195,pack6:39,pack117:20,estimated:true},
  {kind:'equal',a:140,b:140,t:12,kgPerM:25.246,pack6:33,pack117:16,estimated:true},
  {kind:'equal',a:160,b:160,t:10,kgPerM:24.72,pack6:33,pack117:17,estimated:false},
  {kind:'equal',a:160,b:160,t:11,kgPerM:26.682,pack6:31,pack117:16,estimated:true},
  {kind:'equal',a:160,b:160,t:12,kgPerM:29.40,pack6:28,pack117:14,estimated:false},
  {kind:'equal',a:160,b:160,t:14,kgPerM:33.629,pack6:24,pack117:12,estimated:true},
  {kind:'equal',a:160,b:160,t:16,kgPerM:38.43,pack6:21,pack117:11,estimated:false},
  {kind:'equal',a:160,b:160,t:18,kgPerM:42.673,pack6:19,pack117:10,estimated:true},
  {kind:'equal',a:160,b:160,t:20,kgPerM:47.1,pack6:17,pack117:9,estimated:true},
  {kind:'equal',a:180,b:180,t:11,kgPerM:30.136,pack6:27,pack117:14,estimated:true},
  {kind:'equal',a:180,b:180,t:12,kgPerM:32.782,pack6:25,pack117:13,estimated:true},
  {kind:'equal',a:200,b:200,t:12,kgPerM:37,pack6:22,pack117:11,estimated:false},
  {kind:'equal',a:200,b:200,t:13,kgPerM:39.493,pack6:21,pack117:10,estimated:true},
  {kind:'equal',a:200,b:200,t:14,kgPerM:42.421,pack6:19,pack117:10,estimated:true},
  {kind:'equal',a:200,b:200,t:16,kgPerM:48.70,pack6:17,pack117:8,estimated:false},
  {kind:'equal',a:200,b:200,t:20,kgPerM:60.08,pack6:13,pack117:7,estimated:false},
  {kind:'equal',a:200,b:200,t:25,kgPerM:73.594,pack6:11,pack117:5,estimated:true},
  {kind:'equal',a:200,b:200,t:30,kgPerM:87.135,pack6:9,pack117:4,estimated:true},
  {kind:'equal',a:220,b:220,t:14,kgPerM:46.817,pack6:17,pack117:9,estimated:true},
  {kind:'equal',a:220,b:220,t:16,kgPerM:53.254,pack6:15,pack117:8,estimated:true},
  {kind:'equal',a:250,b:250,t:16,kgPerM:60.79,pack6:13,pack117:7,estimated:true},
  {kind:'equal',a:250,b:250,t:18,kgPerM:68.107,pack6:12,pack117:6,estimated:true},
  {kind:'equal',a:250,b:250,t:20,kgPerM:75.36,pack6:11,pack117:5,estimated:true},
  {kind:'equal',a:250,b:250,t:22,kgPerM:82.551,pack6:10,pack117:5,estimated:true},
  {kind:'equal',a:250,b:250,t:25,kgPerM:93.219,pack6:8,pack117:4,estimated:true},
  {kind:'equal',a:250,b:250,t:28,kgPerM:103.746,pack6:8,pack117:4,estimated:true},
  {kind:'equal',a:250,b:250,t:30,kgPerM:110.685,pack6:7,pack117:3,estimated:true},
  // Неравнополочные
  {kind:'unequal',a:25,b:16,t:3,kgPerM:.91,pack6:915,pack117:469,estimated:false},
  {kind:'unequal',a:30,b:20,t:3,kgPerM:1.107,pack6:752,pack117:386,estimated:true},
  {kind:'unequal',a:30,b:20,t:4,kgPerM:1.444,pack6:577,pack117:295,estimated:true},
  {kind:'unequal',a:32,b:20,t:3,kgPerM:1.17,pack6:712,pack117:365,estimated:false},
  {kind:'unequal',a:32,b:20,t:4,kgPerM:1.52,pack6:548,pack117:281,estimated:false},
  {kind:'unequal',a:40,b:25,t:3,kgPerM:1.48,pack6:563,pack117:288,estimated:false},
  {kind:'unequal',a:40,b:25,t:4,kgPerM:1.94,pack6:429,pack117:220,estimated:false},
  {kind:'unequal',a:40,b:25,t:5,kgPerM:2.355,pack6:353,pack117:181,estimated:true},
  {kind:'unequal',a:40,b:30,t:4,kgPerM:2.072,pack6:402,pack117:206,estimated:true},
  {kind:'unequal',a:40,b:30,t:5,kgPerM:2.551,pack6:326,pack117:167,estimated:true},
  {kind:'unequal',a:45,b:28,t:3,kgPerM:1.68,pack6:496,pack117:254,estimated:false},
  {kind:'unequal',a:45,b:28,t:4,kgPerM:2.20,pack6:378,pack117:194,estimated:false},
  {kind:'unequal',a:50,b:32,t:3,kgPerM:1.86,pack6:448,pack117:229,estimated:true},
  {kind:'unequal',a:50,b:32,t:4,kgPerM:2.449,pack6:340,pack117:174,estimated:true},
  {kind:'unequal',a:56,b:36,t:4,kgPerM:2.763,pack6:301,pack117:154,estimated:true},
  {kind:'unequal',a:56,b:36,t:5,kgPerM:3.415,pack6:244,pack117:125,estimated:true},
  {kind:'unequal',a:63,b:40,t:4,kgPerM:3.109,pack6:268,pack117:137,estimated:true},
  {kind:'unequal',a:63,b:40,t:5,kgPerM:3.91,pack6:213,pack117:109,estimated:false},
  {kind:'unequal',a:63,b:40,t:6,kgPerM:4.63,pack6:179,pack117:92,estimated:false},
  {kind:'unequal',a:63,b:40,t:8,kgPerM:5.966,pack6:139,pack117:71,estimated:true},
  {kind:'unequal',a:65,b:50,t:5,kgPerM:4.317,pack6:193,pack117:98,estimated:true},
  {kind:'unequal',a:65,b:50,t:6,kgPerM:5.134,pack6:162,pack117:83,estimated:true},
  {kind:'unequal',a:65,b:50,t:7,kgPerM:5.935,pack6:140,pack117:72,estimated:true},
  {kind:'unequal',a:65,b:50,t:8,kgPerM:6.72,pack6:124,pack117:63,estimated:true},
  {kind:'unequal',a:70,b:45,t:5,kgPerM:4.317,pack6:193,pack117:98,estimated:true},
  {kind:'unequal',a:75,b:50,t:5,kgPerM:4.79,pack6:174,pack117:89,estimated:false},
  {kind:'unequal',a:75,b:50,t:6,kgPerM:5.69,pack6:146,pack117:75,estimated:false},
  {kind:'unequal',a:75,b:50,t:7,kgPerM:6.484,pack6:128,pack117:65,estimated:true},
  {kind:'unequal',a:75,b:50,t:8,kgPerM:7.348,pack6:113,pack117:58,estimated:true},
  {kind:'unequal',a:80,b:50,t:5,kgPerM:4.906,pack6:169,pack117:87,estimated:true},
  {kind:'unequal',a:80,b:50,t:6,kgPerM:5.84,pack6:142,pack117:73,estimated:true},
  {kind:'unequal',a:80,b:60,t:7,kgPerM:7.308,pack6:114,pack117:58,estimated:true},
  {kind:'unequal',a:80,b:60,t:8,kgPerM:8.29,pack6:100,pack117:51,estimated:true},
  {kind:'unequal',a:90,b:56,t:5.5,kgPerM:6.066,pack6:137,pack117:70,estimated:true},
  {kind:'unequal',a:90,b:56,t:6,kgPerM:6.594,pack6:126,pack117:64,estimated:true},
  {kind:'unequal',a:90,b:56,t:8,kgPerM:8.666,pack6:96,pack117:49,estimated:true},
  {kind:'unequal',a:100,b:63,t:6,kgPerM:7.53,pack6:110,pack117:56,estimated:false},
  {kind:'unequal',a:100,b:63,t:7,kgPerM:8.572,pack6:97,pack117:49,estimated:true},
  {kind:'unequal',a:100,b:63,t:8,kgPerM:9.87,pack6:84,pack117:43,estimated:false},
  {kind:'unequal',a:100,b:63,t:10,kgPerM:12.01,pack6:69,pack117:35,estimated:true},
  {kind:'unequal',a:100,b:65,t:8,kgPerM:9.86,pack6:84,pack117:43,estimated:true},
  {kind:'unequal',a:100,b:65,t:10,kgPerM:12.167,pack6:68,pack117:35,estimated:true},
  {kind:'unequal',a:110,b:70,t:6.5,kgPerM:8.853,pack6:94,pack117:48,estimated:true},
  {kind:'unequal',a:110,b:70,t:8,kgPerM:10.802,pack6:77,pack117:39,estimated:true},
  {kind:'unequal',a:125,b:80,t:7,kgPerM:10.88,pack6:76,pack117:39,estimated:true},
  {kind:'unequal',a:125,b:80,t:8,kgPerM:12.55,pack6:66,pack117:34,estimated:false},
  {kind:'unequal',a:125,b:80,t:10,kgPerM:15.47,pack6:53,pack117:27,estimated:false},
  {kind:'unequal',a:125,b:80,t:12,kgPerM:18.181,pack6:45,pack117:23,estimated:true},
  {kind:'unequal',a:140,b:90,t:8,kgPerM:13.942,pack6:59,pack117:30,estimated:true},
  {kind:'unequal',a:140,b:90,t:10,kgPerM:17.27,pack6:48,pack117:24,estimated:true},
  {kind:'unequal',a:160,b:100,t:9,kgPerM:17.733,pack6:46,pack117:24,estimated:true},
  {kind:'unequal',a:160,b:100,t:10,kgPerM:19.85,pack6:41,pack117:21,estimated:false},
  {kind:'unequal',a:160,b:100,t:12,kgPerM:23.60,pack6:35,pack117:18,estimated:false},
  {kind:'unequal',a:160,b:100,t:14,kgPerM:27.035,pack6:30,pack117:15,estimated:true},
  {kind:'unequal',a:180,b:110,t:10,kgPerM:21.98,pack6:37,pack117:19,estimated:true},
  {kind:'unequal',a:180,b:110,t:11,kgPerM:24.092,pack6:34,pack117:17,estimated:true},
  {kind:'unequal',a:180,b:110,t:12,kgPerM:26.188,pack6:31,pack117:16,estimated:true},
  {kind:'unequal',a:200,b:125,t:12,kgPerM:29.60,pack6:28,pack117:14,estimated:false},
  {kind:'unequal',a:200,b:125,t:14,kgPerM:34.179,pack6:24,pack117:12,estimated:true},
  {kind:'unequal',a:200,b:125,t:16,kgPerM:38.80,pack6:21,pack117:11,estimated:false},
];
function anglePackCapacity(row:AngleCatalogRow,length:number):number {
  const reference = Math.abs(length-6)<=Math.abs(length-11.7)?row.pack6:row.pack117;
  const safeMax = Math.floor(5000/(row.kgPerM*length));
  return Math.max(0,Math.min(reference,safeMax));
}

type CargoItem = {angleStandard?:AngleStandard;angleA?:number;angleB?:number;id:number;type:string;length:number;width:number;height:number;weight:number;diameter:number;wall:number;shape:'round'|'square'|'rect';profileWidth:number;profileHeight:number;quantity:number;unitWeight:number;bundleSize?:number;catalogIndex?:number};
// Updated profile packaging reference. Dimensions in mm; counts are alternatives,
// not a mandatory single factory standard. Exact supplier kg/m rows below remain
// available for weight calculations only.
type ProfilePackRule = {a:number;b:number;minWall:number;maxWall:number;counts:readonly number[]};
const PROFILE_PACK_RULES: readonly ProfilePackRule[] = [
  // Square profiles
  [10,.8,1.2,400,600],[15,1,1.5,256,400],[20,1,2,200,256],
  [25,1,3,144,196],[30,1.5,3,121,252],[40,1.5,4,81,100,144],
  [50,2,5,64,81],[60,2,6,49,64],[70,3,8,36,49],
  [80,3,8,25,36],[90,4,8,25],[100,3,10,16,25],
  [120,4,10,9,16],[140,4,10,9,16],[150,5,12,9],
  [160,5,12,4,9],[180,6,14,4,9],[200,6,14,2,4],
].map(([a,minWall,maxWall,...counts])=>({a,b:a,minWall,maxWall,counts}));
const RECT_PROFILE_PACK_RULES: readonly ProfilePackRule[] = [
  [15,10,1,2,300,500],[20,10,1,2,280,400],
  [25,15,1,2,200,300],[30,15,1.2,2.5,180,240],
  [30,20,1.5,3,150,200],[40,20,1.5,4,112,140],
  [40,25,1.5,3,96,120],[50,25,2,4,90,105],
  [50,30,2,4,80,96],[60,30,2,4,70,84],
  [60,40,2,5,60,72],[80,40,2,6,40,50],
  [80,60,3,7,32,40],[100,50,3,8,32,36],
  [100,60,3,8,24,32],[120,60,3,8,20,24],
  [120,80,4,10,15,18],[140,60,4,8,16,20],
  [150,100,4,10,12,15],[160,80,4,8,12],
  [180,100,5,10,8,12],[200,100,5,12,6,8],
  [250,150,6,12,4,6],[300,200,8,12,2,4],
  [400,200,8,14,2],
].map(([a,b,minWall,maxWall,...counts])=>({a,b,minWall,maxWall,counts}));
const ALL_PROFILE_PACK_RULES = [...PROFILE_PACK_RULES,...RECT_PROFILE_PACK_RULES];
function getProfilePackRule(width:number,height:number,wall:number):ProfilePackRule|undefined {
  if(!(width>0&&height>0&&wall>0))return undefined;
  const [a,b]=[width,height].sort((x,y)=>y-x);
  const exact=ALL_PROFILE_PACK_RULES.find(r=>r.a===a&&r.b===b);
  if(exact)return exact;
  // For sizes not explicitly listed, match the nearest cross-section shape.
  const ratio=(x:number,y:number)=>Math.abs(Math.log(Math.max(x,.001)/Math.max(y,.001)));
  const score=(r:ProfilePackRule)=>ratio(a,r.a)*3+ratio(b,r.b)*3+
    (wall<r.minWall?ratio(wall,r.minWall):wall>r.maxWall?ratio(wall,r.maxWall):0)*.5;
  return ALL_PROFILE_PACK_RULES.reduce((best,r)=>score(r)<score(best)?r:best);
}
type CargoPack = {item:CargoItem;index:number;weight:number;length:number;width:number;height:number;x:number;z:number;layer:number;quantity:number};
const PIPE_CATALOG: ReadonlyArray<readonly [number,number,number,number,number,number,number]> = [
  [30,30,1.5,6.0,1.31,252,1.98],
  [30,30,2.0,6.0,1.7,216,2.2],
  [40,20,1.5,6.0,1.31,252,1.98],
  [40,20,2.0,6.0,1.7,224,2.28],
  [40,25,1.5,6.0,1.43,224,1.92],
  [40,25,2.0,6.0,1.86,210,2.34],
  [50,25,1.5,6.0,1.67,176,1.76],
  [50,25,2.0,6.0,2.17,165,2.15],
  [40,40,1.5,6.0,1.78,140,1.495],
  [40,40,1.8,6.0,2.12,168,2.137],
  [40,40,2.0,6.0,2.33,140,1.957],
  [40,40,2.5,6.0,2.85,112,1.915],
  [40,40,3.0,6.0,3.36,112,2.26],
  [50,50,1.5,6.0,2.25,110,1.485],
  [50,50,1.8,6.0,2.68,110,1.769],
  [50,50,2.0,6.0,2.96,110,1.95],
  [50,50,2.5,6.0,3.64,110,2.402],
  [50,50,3.0,6.0,4.31,99,2.56],
  [50,50,4.0,6.0,5.56,110,3.67],
  [60,40,1.5,6.0,2.25,108,1.45],
  [60,40,1.8,6.0,2.68,108,1.737],
  [60,40,2.0,6.0,2.96,108,1.92],
  [60,40,2.5,6.0,3.64,99,2.162],
  [60,40,3.0,6.0,4.3,99,2.55],
  [60,40,4.0,6.0,5.56,108,3.603],
  [60,30,2.0,6.0,2.65,144,2.29],
  [60,30,3.0,6.0,3.83,144,3.31],
  [60,30,4.0,6.0,4.93,144,4.26],
  [60,60,1.5,6.0,2.72,90,1.469],
  [60,60,1.8,6.0,3.25,90,1.755],
  [60,60,2.0,6.0,3.59,90,1.94],
  [60,60,3.0,6.0,5.25,90,2.84],
  [60,60,4.0,6.0,6.82,90,3.68],
  [80,80,2.0,12.0,4.84,36,2.09],
  [80,80,3.0,12.0,7.13,30,2.57],
  [80,80,4.0,12.0,9.33,24,2.69],
  [80,80,5.0,12.0,11.44,18,2.471],
  [80,80,5.0,12.0,11.44,36,4.942],
  [80,40,2.0,6.0,3.59,91,1.96],
  [80,40,3.0,6.0,5.25,63,1.98],
  [80,40,4.0,6.0,6.82,98,4.02],
  [80,60,2.0,12.0,4.22,48,2.43],
  [80,60,3.0,12.0,6.19,36,2.67],
  [80,60,4.0,12.0,8.07,24,2.32],
  [80,60,5.0,12.0,9.87,24,2.843],
  [100,50,2.0,12.0,4.53,50,2.71],
  [100,50,3.0,12.0,6.66,35,2.8],
  [100,50,4.0,12.0,8.7,25,2.61],
  [100,50,5.0,12.0,10.65,20,2.556],
  [100,100,3.0,12.0,9.02,20,2.16],
  [100,100,4.0,12.0,11.84,20,2.84],
  [100,100,5.0,12.0,14.58,15,2.62],
  [100,100,6.0,12.0,16.98,20,4.075],
  [100,100,7.0,12.0,19.12,20,4.589],
  [100,100,8.0,12.0,21.39,15,3.85],
  [100,100,10.0,12.0,26.91,15,4.844],
  [120,120,3.0,12.0,10.84,25,3.25],
  [120,120,3.0,12.0,10.84,15,1.951],
  [120,120,4.0,12.0,14.25,25,4.28],
  [120,120,4.0,12.0,14.25,15,2.57],
  [120,120,4.0,12.0,14.25,20,3.24],
  [120,120,5.0,12.0,17.55,15,3.16],
  [120,120,5.0,12.0,17.55,20,4.212],
  [120,120,5.0,12.0,17.55,25,5.265],
  [120,120,6.0,12.0,20.75,20,4.98],
  [120,120,7.0,12.0,23.52,15,4.234],
  [120,120,8.0,12.0,26.41,15,4.75],
  [120,120,10.0,12.0,33.19,10,3.98],
  [140,100,4.0,12.0,14.25,20,3.42],
  [140,100,5.0,12.0,17.55,20,4.212],
  [140,100,6.0,12.0,20.75,20,4.98],
  [140,100,7.0,12.0,23.52,16,4.516],
  [140,100,8.0,12.0,26.41,12,3.803],
  [140,140,4.0,12.0,16.76,16,3.218],
  [140,140,5.0,12.0,20.69,16,3.972],
  [140,140,6.0,12.0,24.52,16,4.709],
  [140,140,7.0,12.0,27.91,12,4.019],
  [140,140,8.0,12.0,31.43,12,4.53],
  [140,140,10.0,12.0,39.47,8,3.79],
  [150,100,4.0,12.0,14.87,16,2.855],
  [150,100,5.0,12.0,18.33,16,3.519],
  [150,100,6.0,12.0,21.69,16,4.165],
  [150,100,7.0,12.0,25.28,16,4.854],
  [150,100,8.0,12.0,28.53,12,4.108],
  [150,150,4.0,12.0,18.01,16,3.46],
  [150,150,5.0,12.0,22.26,16,4.27],
  [150,150,6.0,12.0,26.4,16,5.07],
  [150,150,8.0,12.0,33.95,12,4.89],
  [150,150,10.0,12.0,42.61,8,4.09],
  [160,140,4.0,12.0,18.01,12,2.593],
  [160,140,5.0,12.0,22.26,12,3.205],
  [160,140,6.0,12.0,26.4,12,3.802],
  [160,140,7.0,12.0,30.11,12,4.336],
  [160,140,8.0,12.0,33.95,12,4.89],
  [160,160,4.0,12.0,19.27,9,2.08],
  [160,160,5.0,12.0,23.83,9,2.57],
  [160,160,6.0,12.0,28.29,9,3.06],
  [160,160,7.0,12.0,32.31,9,3.489],
  [160,160,8.0,12.0,36.46,9,3.94],
  [160,160,10.0,12.0,45.75,9,4.94],
  [160,80,4.0,12.0,14.25,15,2.565],
  [160,80,5.0,12.0,17.55,15,3.159],
  [160,80,6.0,12.0,20.75,15,3.735],
  [160,80,7.0,12.0,23.52,15,4.234],
  [160,80,8.0,12.0,27.27,15,4.909],
  [180,180,5.0,12.0,26.97,9,2.91],
  [180,180,6.0,12.0,32.05,9,3.46],
  [180,180,8.0,12.0,41.48,9,4.48],
  [180,180,7.0,12.0,36.7,9,3.964],
  [180,180,8.0,12.0,41.48,9,4.48],
  [180,180,10.0,12.0,52.03,6,3.75],
  [200,100,4.0,12.0,18.01,15,3.242],
  [200,100,5.0,12.0,22.26,15,4.007],
  [200,100,6.0,12.0,26.4,15,4.752],
  [200,100,7.0,12.0,30.11,12,4.336],
  [200,100,8.0,12.0,33.95,12,4.889],
  [200,100,10.0,12.0,42.61,9,4.602],
  [200,200,5.0,12.0,30.11,9,3.252],
  [200,200,6.0,12.0,35.82,9,3.869],
  [200,200,7.0,12.0,41.1,9,4.439],
  [200,200,8.0,12.0,46.51,6,3.349],
  [200,200,10.0,12.0,56.96,6,4.101],
  [120,80,3.0,12.0,8.96,40,4.3],
  [120,80,4.0,12.0,11.73,35,4.93],
  [120,80,5.0,12.0,14.41,30,5.19],
  [120,80,6.0,12.0,16.98,25,5.09],
  [160,120,4.0,12.0,16.63,12,2.4],
  [160,120,5.0,12.0,20.69,12,2.98],
  [160,120,6.0,12.0,24.58,12,3.54],
  [200,160,5.0,12.0,26.97,12,3.88],
  [200,160,6.0,12.0,32.05,12,4.62],
  [200,160,8.0,12.0,41.48,9,4.48],
  [200,120,4.0,12.0,19.27,15,3.47],
  [200,120,5.0,12.0,23.83,15,4.29],
  [200,120,6.0,12.0,28.29,15,5.09],
  [180,140,4.0,12.0,19.27,12,2.77],
  [180,140,5.0,12.0,23.83,9,2.574],
  [180,140,6.0,12.0,28.29,9,3.055],
  [180,140,7.0,12.0,32.31,9,3.489],
  [180,140,8.0,12.0,36.46,9,3.938],
];
// [width mm, height mm, wall mm, length m, mass kg/m, tubes per bundle, reference pallet tonnes].
// The supplier's pallet weight sometimes differs from kg/m × length × quantity;
// both values are preserved, and load mass uses the published kg/m rate.
const DENSITY=7850;
const VEHICLES:Record<string,{length:number;width:number;height:number;payload:number;maxLength:number}>={
  'Шаланда 13,5 м':{length:13.5,width:2.45,height:2.6,payload:20,maxLength:13.5},
  'Бортовая 6 м':{length:6,width:2.35,height:2.3,payload:10,maxLength:6},
  'Газель 6 м':{length:6,width:2.05,height:2,payload:1.5,maxLength:6},
  'Газель 3 м':{length:3,width:1.9,height:1.85,payload:1.5,maxLength:3},
};
function pieceWeight(type:string,length:number,width:number,diameter:number,wall:number,shape:'round'|'square'|'rect',profileWidth=0,profileHeight=0){
  const d=diameter/1000,t=wall/1000;
  if(type==='Арматура')return Math.PI*d*d/4*length*DENSITY/1000;
  if(type==='Трубы'){
    const a=shape==='round'?d:profileWidth/1000;
    const b=shape==='round'?d:profileHeight/1000;
    if(t<=0||t>=Math.min(a,b)/2)return 0;
    const area=shape==='round'?Math.PI*(d*d-(d-2*t)**2)/4:a*b-(a-2*t)*(b-2*t);
    return area*length*DENSITY/1000;
  }
  if(type==='Уголки')return Math.max(0,(profileWidth+profileHeight-wall)*wall)*1e-6*length*DENSITY/1000;
  if(type==='Лист')return length*width*(wall/1000)*DENSITY/1000;
  return 0;
}
// Supplier loading norms for ROUND steel pipes. For 273 and 219 mm,
// the table specifies TONNES rather than a count of individual pipes.
// An installed full set of stakes selects the "with stakes" norm.
const ROUND_PIPE_LOAD_NORMS: Record<number, {without:number;withStakes:number;unit:'pieces'|'tonnes'}> = {
  1420:{without:1,withStakes:2,unit:'pieces'},
  1220:{without:3,withStakes:4,unit:'pieces'},
  1020:{without:3,withStakes:4,unit:'pieces'},
  820:{without:6,withStakes:8,unit:'pieces'},
  720:{without:6,withStakes:9,unit:'pieces'},
  630:{without:9,withStakes:11,unit:'pieces'},
  530:{without:12,withStakes:15,unit:'pieces'},
  426:{without:12,withStakes:16,unit:'pieces'},
  377:{without:18,withStakes:22,unit:'pieces'},
  325:{without:25,withStakes:30,unit:'pieces'},
  273:{without:16,withStakes:20,unit:'tonnes'},
  219:{without:16,withStakes:20,unit:'tonnes'},
};

// Large round pipes reserve the trailer for the primary load. Only sheet steel
// may be added, subject to the trailer's payload and actual available space.
const LARGE_ROUND_DIAMETER_MM = 325;
function isPrimaryOversized(item: CargoItem): boolean {
  return item.type === 'Трубы' && item.shape === 'round' && item.diameter >= LARGE_ROUND_DIAMETER_MM;
}
const OVERSIZED_NOTICE = 'Основной груз займет все свободное место, на дополнительный груз понадобится еще одна машина';

function tubesPerBundle(item: CargoItem): number {
  if(item.bundleSize && item.bundleSize>0)return item.bundleSize;
  // Only an internal layout batch; round tubes are NEVER bundled.
  if (item.shape === 'round') return 35;
  // 100 x 100 mm is included in the smaller-size group.
  return Math.max(item.profileWidth, item.profileHeight) <= 100 ? 40 : 25;
}

function splitPacks(item: CargoItem): CargoPack[] {
  if (item.weight <= 0 || item.length <= 0 || item.quantity <= 0 || item.unitWeight <= 0) return [];
  const maxPerPack = item.type === 'Трубы'
    ? tubesPerBundle(item)
    : item.type === 'Уголки' ? Math.max(1,item.bundleSize ?? Math.floor(5 / item.unitWeight)) : item.type === 'Арматура' ? Math.max(1, Math.floor(5 / item.unitWeight)) : item.quantity;
  const packs: CargoPack[] = [];
  let remaining = item.quantity;
  while (remaining > 0) {
    const quantity = Math.min(remaining, maxPerPack);
    remaining -= quantity;
    let width = item.width;
    let height = item.height;
    if (item.type === 'Арматура') {
      const diameter = item.diameter / 1000;
      const radius = (diameter / 2) * Math.sqrt(quantity / 0.80);
      width = height = radius * 2;
    } else if (item.type === 'Трубы') {
      const tubeWidth = (item.shape === 'round' ? item.diameter : item.profileWidth) / 1000;
      const tubeHeight = (item.shape === 'round' ? item.diameter : item.profileHeight) / 1000;
      // Round pipes are loose; batches are only virtual groups for spatial planning.
      // Keep the planning envelope identical to the actual rendered geometry.
      // Circular tubes are arranged on a rectangular tangent grid: adjacent
      // cylinders touch, but never intersect (including between rows).
      const availableWidth = VEHICLES['Шаланда 13,5 м'].width;
      const maxColumns = Math.max(1, Math.floor((availableWidth + 1e-8) / tubeWidth));
      const idealColumns = Math.max(1, Math.ceil(Math.sqrt(quantity * tubeHeight / tubeWidth)));
      const columns = Math.min(quantity, maxColumns, idealColumns);
      const rows = Math.ceil(quantity / columns);
      width = columns * tubeWidth;
      height = rows * tubeHeight;
    } else if (item.type === 'Уголки') {
      // Compact nested stacks: the same packing envelope is used in 3D.
      const span = Math.max(item.angleA ?? item.profileWidth, item.angleB ?? item.profileHeight) / 1000;
      const thickness = item.wall / 1000;
      const columns = Math.min(quantity, 8, Math.max(1, Math.floor((VEHICLES['Шаланда 13,5 м'].width - .12) / span)));
      const rows = Math.ceil(quantity / columns);
      const pitch = Math.max(thickness * 2.2, span * .12);
      width = columns * span;
      height = span / 2 + (rows - 1) * pitch;
    } else if (item.type === 'Лист') {
      height = item.wall / 1000 * quantity;
    }
    packs.push({ item, index: packs.length + 1, weight: quantity * item.unitWeight,
      length: item.length, width, height, x: 0, z: 0, layer: 0, quantity });
  }
  return packs;
}

function planCargo(items: CargoItem[], vehicle: string) {
  const v = VEHICLES[vehicle];
  const oversizedPresent = items.some(isPrimaryOversized);
  const allowedItems = oversizedPresent ? items.filter(item => isPrimaryOversized(item) || item.type === 'Лист') : items;
  const all = allowedItems.flatMap(splitPacks);
  const placed: CargoPack[] = [];
  const rejected: CargoPack[] = [];
  let total = 0;
  // Sheets must be at the bottom (or on other sheets); rebar is the preferred
  // bottom layer for other steel products. All cargo up to 6 m follows in tandem.
  const priority = (p: CargoPack) => p.item.type === 'Лист' ? 0 : p.item.type === 'Арматура' ? 1 : 2;
  const ordered = [...all].sort((a,b) => priority(a)-priority(b) || b.weight-a.weight || b.length-a.length);
  const overlap = (a: CargoPack,b: CargoPack) => a.x < b.x+b.width-0.0001 && a.x+a.width > b.x+0.0001 && a.z < b.z+b.length-0.0001 && a.z+a.length > b.z+0.0001;
  const contains = (support: CargoPack,p: CargoPack) => p.x>=support.x-0.0001 && p.x+p.width<=support.x+support.width+0.0001 && p.z>=support.z-0.0001 && p.z+p.length<=support.z+support.length+0.0001;
  // Spatial placement: for ANY item <= 6 m, fill longitudinal slots first,
  // irrespective of item type or its position in the order.
  // Long goods are still allowed to use full trailer length.
  const EPS=.002;
  // Visible clearance between consecutive short cargo units (32 cm).
  // Prevents separate 6 m bundles from appearing as a continuous 12 m piece.
  const gap=.32;
  const supportsAt=(p:CargoPack,x:number,z:number)=>{
    const c={...p,x,z};
    return placed.filter(q=>contains(q,c));
  };
  const levels=(p:CargoPack,x:number,z:number)=>{
    const hs=[0];
    for(const q of supportsAt(p,x,z)){
      if(p.item.type==='Лист'&&q.item.type!=='Лист')continue;
      hs.push(q.layer+q.height+.10);
    }
    return [...new Set(hs.map(h=>+h.toFixed(5)))].sort((a,b)=>a-b);
  };
  for(const pack of ordered){
    if(pack.length>v.length+EPS || pack.width>v.width+EPS || pack.height+.10>v.height || total+pack.weight>v.payload+EPS){rejected.push(pack);continue;}
    const xMax=v.width-pack.width,zMax=v.length-pack.length;
    const xs:number[]=[],zs:number[]=[];
    const add=(arr:number[],val:number,max:number)=>{
      if(val<-.0001||val>max+.0001)return;
      const n=Math.max(0,Math.min(max,val));
      if(!arr.some(x=>Math.abs(x-n)<.002))arr.push(n);
    };
    // Start at the head of the deck and walk towards the tail. A 13.5 m
    // deck therefore fits 6 m + 6 m lengthwise before another lane is used.
    add(zs,0,zMax);
    for(const q of placed){
      add(zs,q.z+q.length+gap,zMax);
      add(zs,q.z-pack.length-gap,zMax);
      add(zs,q.z,zMax);
    }
    for(let z=0;z<=zMax+.001;z+=.25)add(zs,z,zMax);
    add(zs,zMax,zMax);
    add(xs,(v.width-pack.width)/2,xMax);
    add(xs,0,xMax);
    add(xs,xMax,xMax);
    for(const q of placed){
      add(xs,q.x+q.width+.025,xMax);
      add(xs,q.x-pack.width-.025,xMax);
      add(xs,q.x,xMax);
    }
    for(let x=0;x<=xMax+.001;x+=.06)add(xs,x,xMax);
    let best:{x:number;z:number;layer:number;score:number}|null=null;
    for(const x of xs)for(const z of zs)for(const layer of levels(pack,x,z)){
      if(layer+pack.height+.10>v.height+EPS)continue;
      const candidate={...pack,x,z,layer};
      if(placed.some(q=>overlap(candidate,q)&&layer<q.layer+q.height+.015&&layer+pack.height+.015>q.layer))continue;
      if(layer>0&&!placed.some(q=>contains(q,candidate)&&Math.abs(q.layer+q.height+.10-layer)<.002))continue;
      if(pack.item.type==='Лист'&&layer>0&&!placed.some(q=>q.item.type==='Лист'&&contains(q,candidate)&&Math.abs(q.layer+q.height+.10-layer)<.002))continue;
      // Never put rebar on pipes: it is intended as a low support layer.
      if(pack.item.type==='Арматура'&&layer>0&&placed.some(q=>q.item.type==='Трубы'&&contains(q,candidate)))continue;
      const short=pack.length<=6.0001;
      const sameTier=placed.filter(q=>Math.abs(q.layer-layer)<.02);
      const xOverlaps=(q:CargoPack)=>x<q.x+q.width-EPS&&x+pack.width>q.x+EPS;
      const inLane=sameTier.some(xOverlaps);
      const tandem=sameTier.some(q=>xOverlaps(q)&&
        (Math.abs(z-(q.z+q.length+gap))<.17||Math.abs(q.z-(z+pack.length+gap))<.17));
      // For short goods, first reuse the existing longitudinal lane, then
      // occupy a parallel lane, and only then stack. Reusing the same lane
      // across different product types is intentional.
      const lanePenalty=short?(inLane?0:500):0;
      const tandemBonus=short&&tandem?-180:0;
      const score=short
        ? layer*1200+lanePenalty+tandemBonus+z*.85+Math.abs(x+pack.width/2-v.width/2)*.1
        : layer*1200+Math.abs(x+pack.width/2-v.width/2)*1.5+Math.abs(z+pack.length/2-v.length/2)*.7;
      if(!best||score<best.score)best={x,z,layer,score};
    }
    if(!best){rejected.push(pack);continue;}
    pack.x=best.x;pack.z=best.z;pack.layer=best.layer;placed.push(pack);total+=pack.weight;
  }
  return {placed,rejected,total,all,v,sheetTop:0,sheetLength:0,sheetWidth:0,requested:items.reduce((sum,item)=>sum+item.weight,0)};
}

const MODEL_URL = '/models/maz-with-trailer.glb?v=local-v8-rebar';
const IMPORTED_CRANE_URL = '/models/gantry-crane.glb';
const USE_IMPORTED_CRANE = false; // Референс: белый решётчатый кран с широким баннером БРТ
const SECTIONS = ['01', '02', '03', '04'] as const;
const STAKE_NUMBERS = ['01', '02', '03', '04', '05', '06', '07'] as const;
const LEFT_BOARD_ANGLE = Math.PI * 0.52;
const RIGHT_BOARD_ANGLE = -Math.PI * 0.52;
const REAR_GATE_ANGLE = -Math.PI * 0.52;

function boardId(side: Side, number: string): BoardId {
  return `${side}_${number}`;
}

function stakeId(side: Side, number: string): string {
  return `${side}_${number}`;
}

function parseModel(scene: THREE.Object3D): ModelControls {
  const boards = new Map<BoardId, BoardControl>();
  const stakes = new Map<string, StakeControl>();
  let rear: ModelControls['rear'] = null;

  scene.traverse((object) => {
    const boardMatch = /^TRAILER_SIDE_(LEFT|RIGHT)_(\d{2})_PIVOT$/.exec(object.name);
    if (boardMatch) {
      const side = boardMatch[1] as Side;
      const id = boardId(side, boardMatch[2]);
      boards.set(id, {
        object,
        angle: object.rotation.z,
        sign: side === 'LEFT' ? LEFT_BOARD_ANGLE : RIGHT_BOARD_ANGLE,
      });
    }

    const stakeMatch = /^TRAILER_STAKE_(LEFT|RIGHT)_(\d{2})$/.exec(object.name);
    if (stakeMatch) {
      const id = stakeId(stakeMatch[1] as Side, stakeMatch[2]);
      stakes.set(id, { object, id });
    }

    if (object.name === 'TRAILER_REAR_GATE_PIVOT') {
      rear = { object, angle: object.rotation.x };
    }
  });

  return { boards, stakes, rear };
}

function getFailedMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Не удалось открыть 3D-модель. Проверьте файл public/models/maz-with-trailer.glb.';
}

export default function TransportLoadingViewer() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const viewResetRef = useRef<(() => void) | null>(null);
  const [cargoType, setCargoType] = useState('Арматура');
  const [angleStandard,setAngleStandard]=useState<AngleStandard>('equal');
  const [angleA,setAngleA]=useState('75');
  const [angleB,setAngleB]=useState('75');
  const [angleThickness,setAngleThickness]=useState('6');
  const [sandwichItems, setSandwichItems] = useState<SandwichPanel[]>([]);
  // Factory assumptions are internal; only the basic cargo parameters are exposed.
  const [sandwichLength, setSandwichLength] = useState('5');
  const [sandwichWidth, setSandwichWidth] = useState('1020');
  const [sandwichThickness, setSandwichThickness] = useState('100');
  const [sandwichInsulation, setSandwichInsulation] = useState<SandwichPanel['insulation']>('MINERAL_WOOL');
  const [sandwichBundleCapacity, setSandwichBundleCapacity] = useState('8');
  const [sandwichPanelType, setSandwichPanelType] = useState<'wall'|'roof'>('wall');
  const [sandwichInputMode, setSandwichInputMode] = useState<'quantity'|'weight'|'m2'|'m3'>('quantity');
  const [sandwichInputValue, setSandwichInputValue] = useState('25');
  const [animationState, setAnimationState] = useState<'idle'|'playing'|'paused'>('idle');
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const animationRef = useRef({state:'idle' as 'idle'|'playing'|'paused',speed:1,elapsed:0});
  const animationRestartRef = useRef<(() => void)|null>(null);
  const [cargoLength, setCargoLength] = useState('6');
  const [cargoWidth, setCargoWidth] = useState('1.0');
  const [cargoHeight, setCargoHeight] = useState('0.45');
  const [cargoWeight, setCargoWeight] = useState('5');
  const [entryMode,setEntryMode]=useState<'weight'|'quantity'>('weight');
  const [cargoQuantity,setCargoQuantity]=useState('1');
  const [wallThickness,setWallThickness]=useState('5');
  const [formError,setFormError]=useState('');
  const [rebarDiameter, setRebarDiameter] = useState('12');
  const [pipeShape, setPipeShape] = useState<'round' | 'square' | 'rect'>('rect');
  const [catalogIndex,setCatalogIndex]=useState(0);
  const [pipeDiameter, setPipeDiameter] = useState('108');
  const [pipeSquareSide, setPipeSquareSide] = useState('100');
  const [pipeRectWidth,setPipeRectWidth]=useState('40');
  const [pipeRectHeight,setPipeRectHeight]=useState('20');
  const [vehicleType, setVehicleType] = useState('Шаланда 13,5 м');
  const [items, setItems] = useState<CargoItem[]>([]);
  const [nextItemId, setNextItemId] = useState(2);
  const [cargoReport, setCargoReport] = useState('Расчёт загрузки…');
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [availableBoards, setAvailableBoards] = useState(0);
  const [availableStakes, setAvailableStakes] = useState(0);
  const [openBoards, setOpenBoards] = useState<Set<BoardId>>(new Set());
  const [hiddenStakes, setHiddenStakes] = useState<Set<string>>(() => new Set((['LEFT','RIGHT'] as const).flatMap(side=>STAKE_NUMBERS.map(n=>stakeId(side,n)))));
  const [rearOpen, setRearOpen] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [showStakeDetails, setShowStakeDetails] = useState(false);

  const cargoRef = useRef({ items, vehicleType, sandwichItems });
  const rebuildCargoRef = useRef<(() => void) | null>(null);
  useEffect(() => { cargoRef.current = {items,vehicleType,sandwichItems}; rebuildCargoRef.current?.(); }, [items,vehicleType,sandwichItems]);

  const currentDiameter=Number(cargoType==='Арматура'?rebarDiameter:pipeShape==='round'?pipeDiameter:pipeShape==='square'?pipeSquareSide:pipeRectHeight);
  const usingCatalog=cargoType==='Трубы'&&pipeShape!=='round';
  const profileA=Number(pipeRectWidth),profileB=Number(pipeRectHeight);
  const matchingRows=PIPE_CATALOG.map((r,i)=>({r,i})).filter(({r})=>
    ((r[0]===profileA&&r[1]===profileB)||(r[1]===profileA&&r[0]===profileB)) &&
    Math.abs(r[2]-Number(wallThickness))<.001 && Math.abs(r[3]-Number(cargoLength))<.001);
  const catalogMatch=matchingRows.find(({i})=>i===catalogIndex)??matchingRows[0];
  const catalogRow=catalogMatch?.r;
  const angleSizes=ANGLE_CATALOG.filter(r=>r.kind===angleStandard).filter((r,i,all)=>all.findIndex(v=>v.a===r.a&&v.b===r.b)===i);
  const angleRow=ANGLE_CATALOG.find(r=>r.kind===angleStandard&&r.a===Number(angleA)&&r.b===Number(angleB)&&r.t===Number(angleThickness));
  const angleCapacity=angleRow&&Number(cargoLength)>0?anglePackCapacity(angleRow,Number(cargoLength)):0;
  const currentUnitWeight=cargoType==='Уголки' ? (angleRow?angleRow.kgPerM*Number(cargoLength)/1000:0) : usingCatalog&&catalogRow ? catalogRow[4]*Number(cargoLength)/1000 : pieceWeight(cargoType,Number(cargoLength),Number(cargoWidth),currentDiameter,cargoType==='Уголки'?Number(angleThickness):Number(wallThickness),pipeShape,cargoType==='Уголки'?Number(angleA):profileA,cargoType==='Уголки'?Number(angleB):profileB);
  const currentQuantity=entryMode==='quantity'?Math.floor(Number(cargoQuantity)):currentUnitWeight>0?Math.round(Number(cargoWeight)/currentUnitWeight):0;
  const currentActualWeight=currentQuantity*currentUnitWeight;
  // The new packaging reference overrides old supplier bundle counts.
  const packRule=usingCatalog?getProfilePackRule(profileA,profileB,Number(wallThickness)):undefined;
  const [packChoice,setPackChoice]=useState<number|null>(null);
  const packOptions=packRule?.counts??[];
  const currentBundleSize=cargoType==='Трубы'
    ? (usingCatalog?(packOptions.includes(packChoice??-1)?packChoice!:packOptions[0]??40):35)
    : 0;
  const sandwichInsulationDensity = sandwichInsulation === 'EPS' ? 20 : sandwichInsulation === 'PIR_PUR' ? 40 : 110;
  const sandwichInsulationLabel = sandwichInsulation === 'EPS' ? 'Пенополистирол (ППС)' : sandwichInsulation === 'PIR_PUR' ? 'PIR / PUR' : 'Минеральная вата (базальт)';
  const sandwichReferenceWeight = sandwichInsulation === 'EPS' ? '11–12 кг/м²' : sandwichInsulation === 'PIR_PUR' ? '12–13 кг/м²' : '19–22 кг/м²';
  const sandwichUnitWeight = calculatePanelWeightKg({
    id:'preview', insulation:sandwichInsulation, panelType:(sandwichPanelType==='wall'?'WALL_SMOOTH':'ROOF_TRAPEZOID') as SandwichPanel['panelType'],
    lengthMm:Number(sandwichLength)*1000, mountingWidthMm:Math.min(1000,Number(sandwichWidth)),
    actualWidthMm:Number(sandwichWidth), thicknessMm:Number(sandwichThickness), quantity:1,
    insulationDensityKgM3:sandwichInsulationDensity, outerSteelThicknessMm:0.5, innerSteelThicknessMm:0.5,
    outerRal:'RAL 6005', innerRal:'RAL 6005', roofRibHeightMm:35, roofRibCount:5,
  });
  const sandwichPanelArea = Number(sandwichLength)*Number(sandwichWidth)/1000;
  const sandwichPanelVolume = sandwichPanelArea*Number(sandwichThickness)/1000;
  const sandwichInputNumber = Number(sandwichInputValue);
  const sandwichQuantity = !Number.isFinite(sandwichInputNumber) || sandwichInputNumber<=0 ? 0 :
    sandwichInputMode==='quantity' ? Math.floor(sandwichInputNumber) :
    sandwichInputMode==='weight' ? (sandwichUnitWeight>0 ? Math.floor(sandwichInputNumber*1000/sandwichUnitWeight) : 0) :
    sandwichInputMode==='m2' ? (sandwichPanelArea>0 ? Math.floor(sandwichInputNumber/sandwichPanelArea) : 0) :
    sandwichPanelVolume>0 ? Math.floor(sandwichInputNumber/sandwichPanelVolume) : 0;
  const sandwichDraft: SandwichPanel = {
    id:`sandwich-${nextItemId}`, insulation:sandwichInsulation, panelType:(sandwichPanelType==='wall'?'WALL_SMOOTH':'ROOF_TRAPEZOID') as SandwichPanel['panelType'],
    lengthMm:Number(sandwichLength)*1000, mountingWidthMm:Math.min(1000,Number(sandwichWidth)),
    actualWidthMm:Number(sandwichWidth), thicknessMm:Number(sandwichThickness), quantity:sandwichQuantity,
    insulationDensityKgM3:sandwichInsulationDensity, outerSteelThicknessMm:0.5, innerSteelThicknessMm:0.5,
    outerRal:'RAL 6005', innerRal:'RAL 6005', roofRibHeightMm:35, roofRibCount:5,
    panelsPerBundle: Number(sandwichBundleCapacity),
  };
  const sandwichBundlesPreview = Number.isInteger(Number(sandwichBundleCapacity)) && Number(sandwichBundleCapacity)>0 && Number(sandwichBundleCapacity)<=1000 ? createSandwichBundles(sandwichDraft) : [];
  const sandwichAreaM2 = sandwichQuantity * Number(sandwichLength) * Number(sandwichWidth)/1000;
  const sandwichVolumeM3 = sandwichAreaM2 * sandwichDraft.thicknessMm/1000;
  const sandwichTotalWeight = sandwichItems.reduce((sum, panel) =>
    sum + createSandwichBundles(panel).reduce((w, b) => w + b.weightKg, 0), 0);
  const sandwichPlan = planSandwichLoading(sandwichItems.flatMap(createSandwichBundles));

  function addSandwichItem() {
    const p = sandwichDraft;
    if (!Number.isFinite(p.lengthMm) || p.lengthMm<=0 || p.lengthMm>14000 ||
        !Number.isFinite(p.actualWidthMm) || p.actualWidthMm<=0 ||
        p.actualWidthMm>2450 || !Number.isInteger(p.quantity) || p.quantity<=0 ||
        !Number.isInteger(p.panelsPerBundle) || (p.panelsPerBundle ?? 0)<=0 || (p.panelsPerBundle ?? 0)>1000) {
      setFormError('Укажите корректную длину (до 14 м), ширину (до 2450 мм) и положительное количество или вес.');
      return;
    }
    if (items.length) {
      setFormError('Для предварительного расчёта сэндвич-панелей очистите другие виды груза.');
      return;
    }
    setSandwichItems(old => [...old, p]);
    setNextItemId(n=>n+1);
    setFormError('');
    setVehicleType('Шаланда 13,5 м');
  }

  function addItem(){
    if (sandwichItems.length) { setFormError('Для добавления другого груза сначала удалите сэндвич-панели.'); return; }
    const length=Number(cargoLength),width=Number(cargoWidth),wall=Number(wallThickness);
    if(cargoType==='Уголки' && (!angleRow || angleCapacity<1)){setFormError('Выберите уголок из таблицы ГОСТ и проверьте длину: пачка должна быть не тяжелее 5 т.');return;}
    if(cargoType==='Трубы' && (Number(wallThickness)<=0 || (pipeShape==='rect' && (Number(pipeRectWidth)<=0 || Number(pipeRectHeight)<=0)))){setFormError('Проверьте сечение и толщину стенки профильной трубы.');return;}
    if(!Number.isFinite(length)||length<=0||!Number.isFinite(currentUnitWeight)||currentUnitWeight<=0||!Number.isFinite(currentQuantity)||currentQuantity<1){setFormError('Проверьте размеры, толщину и массу: нельзя сформировать ни одного целого изделия.');return;}
    if((cargoType==='Арматура'||cargoType==='Уголки')&&currentUnitWeight>5){setFormError('Одно изделие тяжелее 5 т; сформировать пачку до 5 т невозможно.');return;}
    if(cargoType==='Трубы' && pipeShape==='round'){
      const norm=ROUND_PIPE_LOAD_NORMS[Number(pipeDiameter)];
      if(norm){
        // Only a complete installed set is counted as the "with stakes" case.
        const limit=hiddenStakes.size===0?norm.withStakes:norm.without;
        const already=items.filter(item=>item.type==='Трубы'&&item.shape==='round'&&item.diameter===Number(pipeDiameter));
        const amount=norm.unit==='pieces'
          ? currentQuantity+already.reduce((sum,item)=>sum+item.quantity,0)
          : currentActualWeight+already.reduce((sum,item)=>sum+item.weight,0);
        if(amount>limit+0.000001){
          setFormError(`Для круглой трубы Ø${pipeDiameter} мм допустимо не более ${limit} ${norm.unit==='pieces'?'шт.':'т'} ${hiddenStakes.size===0?'с установленными кониками':'без полного комплекта коников'}.`);
          return;
        }
      }
    }
    if(!['Арматура','Трубы','Лист','Уголки'].includes(cargoType)){setFormError('Для этого вида груза расчёт поштучной массы пока не реализован.');return;}
    const item:CargoItem={id:nextItemId,type:cargoType,angleStandard:cargoType==='Уголки'?angleStandard:undefined,angleA:cargoType==='Уголки'?Number(angleA):undefined,angleB:cargoType==='Уголки'?Number(angleB):undefined,length,width,height:Number(cargoHeight),weight:currentActualWeight,diameter:currentDiameter,wall:cargoType==='Уголки'?Number(angleThickness):wall,shape:usingCatalog?(profileA===profileB?'square':'rect'):pipeShape,profileWidth:cargoType==='Уголки'?Number(angleA):usingCatalog?profileA:pipeShape==='rect'?profileA:Number(pipeSquareSide),profileHeight:cargoType==='Уголки'?Number(angleB):usingCatalog?profileB:pipeShape==='rect'?profileB:Number(pipeSquareSide),quantity:currentQuantity,unitWeight:currentUnitWeight,bundleSize:cargoType==='Уголки'?angleCapacity:currentBundleSize,catalogIndex:catalogMatch?.i};
    const hasOversized = items.some(isPrimaryOversized);
    if ((hasOversized && item.type !== 'Лист' && !isPrimaryOversized(item)) ||
        (isPrimaryOversized(item) && items.some(existing => existing.type !== 'Лист' && !isPrimaryOversized(existing)))) {
      setFormError(OVERSIZED_NOTICE);
      return;
    }
    if (items.reduce((sum, existing) => sum + existing.weight, 0) + item.weight > VEHICLES[vehicleType].payload + 0.000001) {
      setFormError(`Превышена грузоподъёмность ${VEHICLES[vehicleType].payload} т. Для дополнительного груза понадобится ещё одна машина.`);
      return;
    }
    setItems(old=>[...old,item]);setNextItemId(n=>n+1);setFormError('');
  }
  const desiredRef = useRef<DesiredState>({
    openBoards: new Set(),
    hiddenStakes: new Set(),
    rearOpen: false,
    rotate: false,
  });

  useEffect(() => {
    desiredRef.current = { openBoards, hiddenStakes, rearOpen, rotate };
    if (controlsRef.current) controlsRef.current.autoRotate = rotate;
  }, [openBoards, hiddenStakes, rearOpen, rotate]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (initializationError) {
      setError(`Не удалось включить WebGL: ${getFailedMessage(initializationError)}`);
      setLoading(false);
      return;
    }

    let alive = true;
    let animationFrame = 0;
    const clock = new THREE.Clock();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a9cfe9');
    scene.fog = new THREE.Fog('#a9cfe9', 135, 300);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 550);
    camera.position.set(17, 11, 21);
    cameraRef.current = camera;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.autoRotateSpeed = 0.65;
    controls.minDistance = 2;
    controls.maxDistance = 125;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.screenSpacePanning = true;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight('#f5fbff', '#77818d', 0.95));
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.4);
    keyLight.position.set(-15, 27, 20);
    keyLight.castShadow=true;
    keyLight.shadow.mapSize.set(3072,3072);
    keyLight.shadow.camera.left=-65;keyLight.shadow.camera.right=65;
    keyLight.shadow.camera.top=65;keyLight.shadow.camera.bottom=-65;
    keyLight.shadow.camera.near=.5;keyLight.shadow.camera.far=130;
    keyLight.shadow.bias=-.0002;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#cce2ff', .85);
    rimLight.position.set(18, 18, -19);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(100, 100, '#b5c1ce', '#d4dce5');
    const gridMaterial = grid.material;
    if (Array.isArray(gridMaterial)) gridMaterial.forEach((material) => { material.transparent = true; material.opacity = 0.23; });
    else { gridMaterial.transparent = true; gridMaterial.opacity = 0.23; }
    grid.visible = false;
    scene.add(grid);

    let root: THREE.Object3D | null = null;
    let objects: ModelControls | null = null;
    let cargoGroup: THREE.Group | null = null;
    const animatedBundles: {group:THREE.Group; destination:THREE.Vector3; start:THREE.Vector3; height:number}[] = [];
    let craneRig: THREE.Group | null = null;
     let importedCrane: THREE.Group | null = null;
     let importedCraneMixer: THREE.AnimationMixer | null = null;
     let importedCraneDuration = 0;
     let importedCraneReady = false;
     let webTrolley: THREE.Object3D | null = null;
     let webHook: THREE.Object3D | null = null;
     // Read through accessors: these objects may be initialized asynchronously.
     const getImportedCrane = (): THREE.Group | null => importedCrane;
     const getImportedCraneMixer = (): THREE.AnimationMixer | null => importedCraneMixer;
     const getWebTrolley = (): THREE.Object3D | null => webTrolley;
     const getWebHook = (): THREE.Object3D | null => webHook;

     let webTrolleyHome = new THREE.Vector3();
     let webHookHome = new THREE.Vector3();

     let webTrolleyWorldHome = new THREE.Vector3();
     let webHookWorldHome = new THREE.Vector3();

     let webAxis = new THREE.Vector3(0, 0, 1);
     let webTravelMin = -20;
     let webTravelMax = 20;

     let webRopeGroup: THREE.Group | null = null;
     let webRopes: THREE.Mesh[] = [];

     let webLastTravel = 0;
     let webReady = false;
      let webGantry: THREE.Object3D | null = null;
      let webGantryHome = new THREE.Vector3();
      let webGantryWorldHome = new THREE.Vector3();
      const webRailDirection = new THREE.Vector3(0,0,1);
      const webRailLimits = {min:-41,max:41};

     const worldPosition = (object: THREE.Object3D) =>
       object.getWorldPosition(new THREE.Vector3());

     const moveWorld = (
       object: THREE.Object3D,
       target: THREE.Vector3
     ) => {
       if (!object.parent) return;

       object.parent.updateWorldMatrix(true, false);

       const local = object.parent.worldToLocal(target.clone());

       object.position.copy(local);
       object.updateWorldMatrix(true, true);
     };

     const setCable = (cable: THREE.Mesh, worldA: THREE.Vector3, worldB: THREE.Vector3) => {
       // Cable meshes are children of craneYard, not of the world scene.
       // Convert both endpoints to their actual parent's coordinate space.
       const parent = cable.parent;
       if (!parent) return;
       parent.updateWorldMatrix(true, false);
       const a = parent.worldToLocal(worldA.clone());
       const b = parent.worldToLocal(worldB.clone());
       const direction = b.clone().sub(a);
       const length = Math.max(0.02, direction.length());
       cable.position.copy(a).add(b).multiplyScalar(0.5);
       cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
       cable.scale.set(1, length, 1);
     };

     // Geometry-based alignment: GLB pivot positions are not reliable attachment points.
     const visibleBounds = (object: THREE.Object3D) => {
       object.updateWorldMatrix(true, true);
       return new THREE.Box3().setFromObject(object);
     };
     const alignVisibleCenter = (object: THREE.Object3D, target: THREE.Vector3) => {
       const box = visibleBounds(object);
       if (box.isEmpty()) return;
       const center = box.getCenter(new THREE.Vector3());
       const pivot = worldPosition(object);
       moveWorld(object, pivot.add(target.clone().sub(center)));
     };
     const trolleyAnchor = () => {
       if (!webTrolley) return new THREE.Vector3();
       const box = visibleBounds(webTrolley);
       return box.isEmpty() ? worldPosition(webTrolley) :
         new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
     };
     const updateWebRopes = () => {
       if (!webReady || !webTrolley || !webHook || webRopes.length !== 2) return;
       const upper = trolleyAnchor();
       const hookBox = visibleBounds(webHook);
       if (hookBox.isEmpty()) return;
       const lower = new THREE.Vector3((hookBox.min.x + hookBox.max.x) / 2,
         hookBox.max.y - 0.06, (hookBox.min.z + hookBox.max.z) / 2);
       const cableTopY = Math.max(lower.y + 0.05, upper.y - 0.05);
       for (let i = 0; i < 2; i++) {
         const dx = i === 0 ? -0.095 : 0.095;
         setCable(webRopes[i],
           new THREE.Vector3(upper.x + dx, cableTopY, upper.z),
           new THREE.Vector3(lower.x + dx, lower.y, lower.z));
       }
     };
     const resetWebCrane = () => {
       const trolley = getWebTrolley();
       const hook = getWebHook();
       if (!trolley || !hook) return;
       const imported = getImportedCrane();
       if (imported) imported.position.z = 0;
       trolley.position.copy(webTrolleyHome);
       trolley.updateWorldMatrix(true, true);
       hook.position.copy(webHookHome);
       const upper = trolleyAnchor();
       const box = visibleBounds(hook);
       const hookHeight = box.isEmpty() ? 0.65 : box.getSize(new THREE.Vector3()).y;
       alignVisibleCenter(hook, new THREE.Vector3(upper.x,
         upper.y - 1.0 - hookHeight / 2, upper.z));
       webLastTravel = 0;
       updateWebRopes();
     };
     let craneYard: THREE.Group | null = null;
    let craneBaseZ = 0;
    let craneHook: THREE.Group | null = null;
    let craneCable: THREE.Mesh | null = null;
    let craneTrolley: THREE.Group | null = null;
    let liftingSlings: THREE.Group | null = null;
    let slingMaterial: THREE.MeshStandardMaterial | null = null;
    let yardGround = 0;
    let yardAxis: 'x'|'z' = 'z';
    let craneRailHalfSpan = 17.1;
    // Hoist is attached to the moving gantry; trolley travels across the span.
    // All positions below are converted from world coordinates into yard coordinates.
     const cranePose = (
       requestedWorld: THREE.Vector3,
       requestedHookY: number
     ) => {
               const imported = getImportedCrane();
               if (webReady && webTrolley && webHook && imported && craneYard) {
          // The complete gantry moves along the longitudinal yard rails (Z).
          // Only the trolley moves across the bridge (X). Never move the
          // trolley to a target along the longitudinal axis.
          const yardTarget = craneYard.worldToLocal(requestedWorld.clone());
          const longitudinal = THREE.MathUtils.clamp(yardTarget.z, -39, 39);
          imported.position.z = longitudinal;
          imported.updateWorldMatrix(true, true);

          // Move the actual trolley geometry rather than its offset GLB pivot.
          const currentAnchor = trolleyAnchor();
          const anchorLocal = craneYard.worldToLocal(currentAnchor.clone());
          const travel = THREE.MathUtils.clamp(yardTarget.x - anchorLocal.x,
            webTravelMin - webLastTravel, webTravelMax - webLastTravel);
          moveWorld(webTrolley, worldPosition(webTrolley).addScaledVector(webAxis, travel));
          const upper = trolleyAnchor();
          const hookBox = visibleBounds(webHook);
          const hookHeight = hookBox.isEmpty() ? 0.65 : hookBox.getSize(new THREE.Vector3()).y;
          const desiredHookCenterY = THREE.MathUtils.clamp(
            requestedHookY, yardGround + hookHeight / 2 + 0.25,
            upper.y - hookHeight / 2 - 0.45);
          alignVisibleCenter(webHook, new THREE.Vector3(upper.x, desiredHookCenterY, upper.z));
          webLastTravel = travel;
          updateWebRopes();
          return;
        }

// Резервный процедурный кран.
       if (
         !craneRig ||
         !craneYard ||
         !craneHook ||
         !craneCable ||
         !craneTrolley
       ) return;

       const local = craneYard.worldToLocal(requestedWorld.clone());
       const top = 12.45;

       const x = THREE.MathUtils.clamp(
         local.x,
         -craneRailHalfSpan + 0.65,
         craneRailHalfSpan - 0.65
       );

       const z = THREE.MathUtils.clamp(local.z, -41.5, 41.5);

       const y = THREE.MathUtils.clamp(
         requestedHookY - yardGround,
         0.7,
         top - 0.45
       );

       craneRig.position.z = z;
       craneTrolley.position.set(x, top, 0);
       craneHook.position.set(x, y, 0);

               // Position all four hoist ropes from the trolley to the moving block.
        // Their upper and lower ends stay aligned during travel and lifting.
        for(const [name,dx,dz] of [
          ['VERTICAL_HOIST_ROPE_LEFT',-.22,-.19],
          ['VERTICAL_HOIST_ROPE_RIGHT',.22,-.19],
          ['VERTICAL_HOIST_ROPE_3',-.22,.19],
          ['VERTICAL_HOIST_ROPE_4',.22,.19]
        ] as const){
          const rope=craneRig.getObjectByName(name) as THREE.Mesh | undefined;
          if(!rope)continue;
          const upper=top-.17;
          const lower=y+.16;
          rope.position.set(x+dx,(upper+lower)/2,dz);
          rope.scale.set(1,Math.max(.08,upper-lower),1);
          rope.visible=true;
        }
     };
     animationRestartRef.current = () => {
      animationRef.current.elapsed = 0;
      for (const item of animatedBundles) item.group.position.copy(item.start);
      if (craneRig) craneRig.position.z = craneBaseZ;
       if (getImportedCrane()) getImportedCrane()!.position.z = 0;
       resetWebCrane();
       getImportedCraneMixer()?.setTime(0);
      if (craneHook) { craneHook.visible = true; craneHook.position.set(0,10.7,0); }
      if (craneCable) { craneCable.visible = true; craneCable.position.set(-.22,11.65,-.19); craneCable.scale.y=1.9; }
      craneRig?.traverse(obj=>{
        if(obj.name.startsWith('VERTICAL_HOIST_ROPE_') && obj!==craneCable){
          obj.visible=true;
        }
      });
      if (craneTrolley) { craneTrolley.visible = true; craneTrolley.position.set(0,12.65,0); }
    };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    const cargoSteel = new THREE.MeshStandardMaterial({ color: '#555d62', metalness: 0.76, roughness: 0.34 });
    const warehouseGreen = new THREE.MeshStandardMaterial({ color: '#4d7262', metalness: 0.18, roughness: 0.77 });
    const warehouseYellow = new THREE.MeshStandardMaterial({ color: '#c8a45e', metalness: 0.15, roughness: 0.75 });
    const craneOrange = new THREE.MeshStandardMaterial({ color: '#c35c25', metalness: 0.55, roughness: 0.46 });
    const craneDark = new THREE.MeshStandardMaterial({ color: '#353c41', metalness: 0.62, roughness: 0.48 });
    const concrete = new THREE.MeshStandardMaterial({ color: '#b9b8b1', roughness: 0.94 });
    function beam(parent: THREE.Object3D, name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.name = name; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    }
     function createYard(groundY:number,center:THREE.Vector3,longAxis:'x'|'z'){
       const yard=new THREE.Group();scene.add(yard);yard.name='МЕТАЛЛОБАЗА_РЕЛЬСОВЫЙ_КРАН';
       craneYard=yard; yardGround=groundY; yardAxis=longAxis;
       // Local coordinates: longitudinal Z, across X. Rotate the entire yard for X-oriented vehicles.
       yard.position.set(center.x,groundY,center.z);
       if(longAxis==='x')yard.rotation.y=Math.PI/2;
       const mat=(c:string,metal=0,rough=.8)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
       const concrete=mat('#aeb4b8'),asphalt=mat('#545b61'),paint=mat('#e2ddc5'),yellow=mat('#d6a72b',.35),crane=mat('#d98c27',.48),steel=mat('#4b555c',.7),roof=mat('#54717d',.35),brick=mat('#a2a6a2');
       const B=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=yard)=>beam(parent,name,w,h,d,x,y,z,m);
       B('Industrial ground',165,.14,175,0,-.13,0,concrete);
       // Single truck lane, located between the gantry rails.
       B('Main asphalt access road',6.5,.035,145,0,.004,13,asphalt);
       for(const x of [-3.15,3.15])B('Road edge',.11,.013,145,x,.033,13,paint);
       // One wide truck lane: no center divider through the loading zone.
       // Crane rails sit on their own sleepers, parallel to the truck.
       for(const x of [-craneRailHalfSpan,craneRailHalfSpan]){
         B('Rail foundation',1.15,.2,90,x,.035,0,concrete);
         for(let z=-44;z<=44;z+=1.5)B('Rail sleeper',1.55,.12,.26,x,.15,z,steel);
         B('CRANE RAIL',.18,.18,90,x,.29,0,steel);
       }
         // Detailed industrial gantry, with the existing rail-constrained kinematics.
         const rig = new THREE.Group();
         rig.name = 'RAIL_MOUNTED_INDUSTRIAL_GANTRY';
         yard.add(rig); craneRig = rig; craneBaseZ = 0;
         const span = craneRailHalfSpan;
         const structural = mat('#e5e9ed',.58,.31);
         const highlight = mat('#f4f8fb',.42,.35);
         const darkSteel = mat('#29343b',.76,.32);
         const glazing = mat('#294e5e',.32,.19);
         const safety = mat('#dcae38',.35,.48);
         const addMember=(name:string,from:THREE.Vector3,to:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D=rig)=>{
           const d=new THREE.Vector3().subVectors(to,from);
           const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),m);
           mesh.name=name;mesh.position.copy(from).add(to).multiplyScalar(.5);
           mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(mesh);return mesh;
         };
         // Open lattice tower legs and four-chord spatial truss bridge.
         for (const side of [-1, 1]) {
           const railX = side * span;
           B('Rail bogie chassis',1.55,.58,5.7,railX,.67,0,darkSteel,rig);
           for (const z of [-2.2,-.9,.9,2.2]) {
             const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.24,24),darkSteel);
             wheel.name='Steel flanged travel wheel';wheel.rotation.z=Math.PI/2;
             wheel.position.set(railX,.43,z);rig.add(wheel);
             B('Axle bearing housing',.48,.38,.53,railX,.8,z,structural,rig);
           }
           const legX=(y:number)=>railX-side*.82*(y/13);
           const legZ=(y:number)=>2.2-1.25*(y/13);
           for(const zSide of [-1,1]) {
             addMember('Lattice leg main chord',new THREE.Vector3(railX,1.0,zSide*2.2),new THREE.Vector3(legX(12.95),12.95,zSide*legZ(12.95)),.16,structural);
             addMember('Lattice leg inner chord',new THREE.Vector3(railX-side*.72,1.0,zSide*2.2),new THREE.Vector3(legX(12.95)-side*.55,12.95,zSide*legZ(12.95)),.12,structural);
           }
           for(let y=1.3;y<12.5;y+=1.55) {
             const y2=Math.min(12.95,y+1.55);
             for(const xx of [0,-.65]) {
               addMember('Tower X diagonal',new THREE.Vector3(legX(y)+side*xx,y,-legZ(y)),new THREE.Vector3(legX(y2)+side*xx,y2,legZ(y2)),.067,highlight);
               addMember('Tower X reverse',new THREE.Vector3(legX(y)+side*xx,y,legZ(y)),new THREE.Vector3(legX(y2)+side*xx,y2,-legZ(y2)),.067,highlight);
             }
           }
           B('Tower head saddle',1.8,.5,2.8,legX(12.95),12.95,0,structural,rig);
         }
         // Spatial bridge: no solid web plates. Four longitudinal chords, X-bracing and crossframes.
         for(const z of [-1.05,1.05]) {
           for(const y of [12.9,15.35]) {
             B('Truss continuous chord',span*2+2,.21,.21,0,y,z,structural,rig);
           }
           for(let x=-span;x<span;x+=1.7) {
             const x2=Math.min(span,x+1.7);
             addMember('Bridge web diagonal',new THREE.Vector3(x,12.9,z),new THREE.Vector3(x2,15.35,z),.072,structural);
             addMember('Bridge web counter diagonal',new THREE.Vector3(x,15.35,z),new THREE.Vector3(x2,12.9,z),.072,highlight);
             addMember('Bridge vertical post',new THREE.Vector3(x,12.9,z),new THREE.Vector3(x,15.35,z),.075,structural);
           }
         }
         for(let x=-span;x<=span;x+=1.7) {
           for(const y of [12.9,15.35]) addMember('Bridge cross tie',new THREE.Vector3(x,y,-1.05),new THREE.Vector3(x,y,1.05),.07,structural);
           if(x<span-1.7) {
             addMember('Bridge top plan diagonal',new THREE.Vector3(x,15.35,-1.05),new THREE.Vector3(x+1.7,15.35,1.05),.055,highlight);
             addMember('Bridge bottom plan diagonal',new THREE.Vector3(x,12.9,1.05),new THREE.Vector3(x+1.7,12.9,-1.05),.055,highlight);
           }
         }
         B('Maintenance grated walkway',span*2,.10,.85,0,12.72,-1.65,darkSteel,rig);
         for(let x=-span;x<=span;x+=1.4) B('Guardrail upright',.045,.95,.045,x,13.25,-2.06,structural,rig);
         B('Walkway top handrail',span*2,.055,.055,0,13.73,-2.06,structural,rig);
         B('Walkway middle handrail',span*2,.045,.045,0,13.25,-2.06,structural,rig);
         // Inspection floodlights removed: they overlapped the BRT banner artwork.

         // Detailed maintenance deck and continuous safety rails.
         B('Upper inspection deck',span*2+1.4,.095,1.05,0,15.55,-.48,darkSteel,rig);
         for(let x=-span;x<=span;x+=1.05){
           B('Upper deck anti-slip grating',.075,.025,1.02,x,15.62,-.48,highlight,rig);
           for(const z of [-1.05,.09])B('Upper guardrail upright',.055,1.04,.055,x,16.12,z,structural,rig);
         }
         for(const z of [-1.05,.09]){
           B('Upper guardrail top',span*2+1.4,.065,.065,0,16.65,z,structural,rig);
           B('Upper guardrail middle',span*2+1.4,.045,.045,0,16.17,z,structural,rig);
         }
         // Reinforced joints and motorized rail bogies.
         for(const x of [-span,-span*.5,0,span*.5,span])for(const z of [-1.05,1.05]){
           B('Bridge lower gusset',.34,.44,.065,x,12.97,z,structural,rig);
           B('Bridge upper gusset',.34,.40,.065,x,15.29,z,structural,rig);
         }
         B('Electrical cable tray',span*2,.16,.26,0,12.53,-1.3,darkSteel,rig);
         for(const side of [-1,1]){
           const x=side*span;
           B('Rail travel motor',.85,.58,.7,x,.98,1.75,structural,rig);
           B('Rail travel gearbox',.58,.46,.62,x,.98,-1.75,darkSteel,rig);
           for(const z of [-2.5,2.5])B('End stop buffer',.38,.40,.33,x,.52,z,darkSteel,rig);
         }
         // Branded fabric billboard, mounted on the truss, not on the trolley.
         // Real BRT artwork from the supplied reference image.
         // Approved banner remains at public/textures/brt-crane-banner-full.jpg.
         const bannerFallback = new THREE.MeshBasicMaterial({
           color:'#092b55',side:THREE.DoubleSide,
           toneMapped:false
         });
         const banner = new THREE.Mesh(new THREE.PlaneGeometry(27.0,3.83),bannerFallback);
         banner.name='BRT advertising banner';
         banner.position.set(0,14.13,1.39);
         rig.add(banner);
         const bannerLoader = new THREE.TextureLoader();
         bannerLoader.load('/textures/brt-crane-banner-full.jpg?v=brt-20261027-3',(texture)=>{
           texture.colorSpace=THREE.SRGBColorSpace;
           texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
           texture.minFilter=THREE.LinearMipmapLinearFilter;
           texture.magFilter=THREE.LinearFilter;
           banner.material=new THREE.MeshBasicMaterial({
             map:texture,side:THREE.DoubleSide,toneMapped:false
           });
           bannerFallback.dispose();
         },undefined,(error)=>{
           console.error('BRT banner image not loaded: /textures/brt-crane-banner-full.jpg',error);
           // Magenta diagnostic material instead of silently displaying a different banner.
           banner.material=new THREE.MeshBasicMaterial({color:'#d51d87',side:THREE.DoubleSide,toneMapped:false});
           bannerFallback.dispose();
         });
         for(const x of [-13.55,13.55]) B('Banner vertical mounting frame',.09,3.93,.12,x,14.13,1.37,darkSteel,rig);
         for(const y of [12.17,16.09]) B('Banner horizontal mounting frame',27.1,.09,.12,0,y,1.37,darkSteel,rig);
         // Operator cabin and service ladder are fixed to the moving gantry.
         B('Operator cabin shell',2.15,2.25,1.8,-span+2.05,11.35,-2.0,structural,rig);
         B('Operator cabin panoramic glazing',1.93,1.12,.07,-span+2.05,11.55,-2.95,glazing,rig);
         B('Cabin side glazing',.065,1.12,1.36,-span+1.0,11.55,-2.0,glazing,rig);
         B('Cabin roof',2.38,.16,2.04,-span+2.05,12.57,-2.0,darkSteel,rig);
         // Rear access: door and ladder are both on the +Z (service) side.
         // The cabin entrance is reached from a guarded intermediate landing.
         const accessX=-span+2.05;
         const accessZ=-.96;
         B('Cabin rear access platform',2.45,.14,1.18,accessX,10.20,accessZ+.58,darkSteel,rig);
         for(const x of [accessX-1.05,accessX+1.05]){
           B('Landing guard post',.07,1.05,.07,x,10.77,accessZ+1.09,safety,rig);
         }
         B('Landing handrail',2.2,.07,.07,accessX,11.28,accessZ+1.09,safety,rig);
         // Ladder is attached to the rear platform, not to the cabin window.
         const ladderX=accessX+.66;
         const ladderZ=accessZ+1.03;
         for(const x of [ladderX-.32,ladderX+.32])
           B('Caged ladder stile',.065,9.65,.065,x,5.31,ladderZ,darkSteel,rig);
         for(let y=.7;y<10.05;y+=.36)
           B('Caged ladder rung',.66,.055,.085,ladderX,y,ladderZ,safety,rig);
         // Three-quarter protective hoops and longitudinal cage rails.
         for(let y=2.1;y<9.95;y+=1.05){
           const hoop=new THREE.Mesh(new THREE.TorusGeometry(.64,.035,8,24,Math.PI*1.55),safety);
           hoop.rotation.x=Math.PI/2;
           hoop.position.set(ladderX,y,ladderZ+.32);
           rig.add(hoop);
         }
         for(const dx of [-.57,.57])
           B('Ladder cage vertical',.055,7.9,.055,ladderX+dx,6.0,ladderZ+.65,safety,rig);
         // Exposed reinforcement is kept OUTSIDE the box-section legs and cabin.
         for(const side of [-1,1]){
           const x=side*(span+0.24);
           for(const z of [-1.62,1.62]){
             addMember('External leg reinforcement',new THREE.Vector3(x,2.05,z),new THREE.Vector3(x-side*.58,11.75,z*.42),.075,highlight);
           }
         }
         // The trolley, ropes and hook share the same moving parent as the bridge.
         const trolley=new THREE.Group();trolley.name='BRIDGE_CROSS_TRAVEL_TROLLEY';rig.add(trolley);craneTrolley=trolley;
         B('Trolley machinery deck',2.2,.27,2.0,0,0,0,darkSteel,trolley);
         B('Trolley service platform',2.55,.09,2.35,0,.12,0,highlight,trolley);
         for (const z of [-.83,.83]) {
           B('Trolley side rail',2.45,.12,.12,0,.29,z,structural,trolley);
         }
         for (const x of [-.95,.95]) {
           B('Trolley gearbox',.43,.52,.48,x,.44,0,structural,trolley);
         }
         for (const z of [-.60,.60]) {
           B('Hoist drum support',.18,.63,.72,-.15,.54,z,highlight,trolley);
         }
         const drum = new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,1.05,28),darkSteel);
         drum.rotation.x=Math.PI/2;drum.position.set(0,.55,0);trolley.add(drum);
         for(let i=-4;i<=4;i++){
           const ring=new THREE.Mesh(new THREE.TorusGeometry(.337,.022,6,24),safety);
           ring.position.set(0,.55,i*.105);trolley.add(ring);
         }
         for(const z of [-.80,.80]) {
           B('Bridge trolley runway',span*2-1.1,.14,.18,0,12.62,z,darkSteel,rig);
         }

         // Drum remains exposed so the winding grooves are visible.
         B('Hoist motor casing',.65,.58,.62,-1.28,.56,0,structural,trolley);
         B('Hoist reduction gearbox',.48,.62,.66,1.23,.56,0,darkSteel,trolley);
         for(const x of [-1.48,-1.08]){
           const cap=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.11,20),safety);
           cap.rotation.z=Math.PI/2;cap.position.set(x,.57,0);trolley.add(cap);
         }
         for(const z of [-.53,.53]){
           const flange=new THREE.Mesh(new THREE.CylinderGeometry(.41,.41,.065,32),highlight);
           flange.rotation.x=Math.PI/2;flange.position.set(0,.55,z);trolley.add(flange);
         }
         for(const x of [-.84,.84])for(const z of [-.65,.65]){
           const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.15,16),darkSteel);
           wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.2,z);trolley.add(wheel);
         }
         const cable=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1,12),darkSteel);
         cable.name='VERTICAL_HOIST_ROPE_LEFT';rig.add(cable);craneCable=cable;
         const secondCable = new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1,12),darkSteel);
         secondCable.name='VERTICAL_HOIST_ROPE_RIGHT';rig.add(secondCable);
         secondCable.position.set(.22,11.65,0);secondCable.scale.y=1.9;
         // Four-fall reeving: each rope follows the trolley and the hook block.
         for(const [name,dx,dz] of [
           ['VERTICAL_HOIST_ROPE_3',-.22,.19],
           ['VERTICAL_HOIST_ROPE_4',.22,.19]
         ] as const){
           const rope=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1,12),darkSteel);
           rope.name=name;rope.position.set(dx,11.65,dz);rope.scale.y=1.9;rig.add(rope);
         }
         const hook=new THREE.Group();hook.name='HOOK_BLOCK_SPAREADER_AND_SLINGS';rig.add(hook);craneHook=hook;
         // Compact moving sheave assembly, with the steel hook and the spreader
         // forming one connected suspension (no floating elements).
         B('Hoist block steel housing',.68,.34,.49,0,0,0,structural,hook);
         for(const z of [-.19,.19]){
           const sheave=new THREE.Mesh(new THREE.CylinderGeometry(.245,.245,.085,40),darkSteel);
           sheave.rotation.x=Math.PI/2;sheave.position.set(0,.015,z);hook.add(sheave);
           const hub=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.095,24),highlight);
           hub.rotation.x=Math.PI/2;hub.position.set(0,.015,z);hook.add(hub);
         }
         B('Hoist block lower pin',.48,.09,.44,0,-.22,0,highlight,hook);
         B('Hook swivel shaft',.105,.23,.105,0,-.38,0,darkSteel,hook);
         const hookArc=new THREE.Mesh(new THREE.TorusGeometry(.18,.048,12,36,Math.PI*1.65),darkSteel);
         hookArc.rotation.z=Math.PI;hookArc.position.set(.035,-.55,0);hook.add(hookArc);
         // The load-specific spreader and basket slings are created in world space.
         // The moving block carries only the hook: no beam may intersect cargo.
         const slings = new THREE.Group();
         slings.name = 'LOAD_SPECIFIC_RIGGING';
         scene.add(slings);
         liftingSlings = slings;
         slingMaterial = mat('#e2a12f',.08,.72);
         // Door opens towards the protected rear landing (+Z), not the side window.
         const door = new THREE.Group();
         door.name='CABIN_REAR_ACCESS_DOOR';
         door.position.set(-span+2.05,11.25,-1.065);
         rig.add(door);
         B('Rear door leaf',.90,1.78,.065,0,0,0,structural,door);
         B('Rear door window',.64,.78,.075,0,.30,.045,glazing,door);
         B('Door upper frame',1.02,.07,.09,0,.91,.05,darkSteel,door);
         B('Door handle',.10,.075,.12,.33,-.20,.10,darkSteel,door);
         for(const y of [-.64,.65])B('Rear door hinge',.09,.15,.11,-.47,y,.07,darkSteel,door);
         trolley.visible=true;cable.visible=true;hook.visible=true;
       // Procedural gantry only: no GLB loading, no competing animations.
       importedCraneReady = false;
       rig.visible = true;
       trolley.visible = true;
       cable.visible = true;
       hook.visible = true;
       trolley.position.set(0,12.65,0);
       hook.position.set(0,10.7,0);
       cable.position.set(-.22,11.65,-.19);
       cable.scale.y = 1.9;
       // Large metal warehouses, loading docks and sliding doors.
       for(const [x,z,w,d] of [[-33,-22,31,38],[34,-25,31,43]] as number[][]){
         B('Warehouse wall',w,8,d,x,4,z,brick);
         B('Warehouse roof',w+1,.5,d+1,x,8.3,z,roof);
         for(let k=0;k<5;k++){
           B('Warehouse industrial door',3.9,4.8,.12,x-w/2+4+k*5.2,2.45,z+d/2+.08,steel);
           B('Warehouse lintel',4,.17,.2,x-w/2+4+k*5.2,5,z+d/2+.16,yellow);
         }
         for(let k=0;k<12;k++)B('Warehouse wall ribs',.09,8,.1,x-w/2+.8+k*(w-1.6)/11,4,z+d/2+.14,roof);
       }
       // Dedicated sandwich-panel staging area, between truck lane and eastern rail.
       B('Sandwich panel staging concrete',5.6,.10,90,5.5,.08,0,concrete);
       for(const x of [2.7,8.3]) B('Staging edge',.10,.025,90,x,.13,0,yellow);
       // Storage lanes: stacks of real long steel, separated from road.
       for(const side of [-1,1])for(let row=0;row<5;row++){
         const x=side*(14+row*3.4),z=10+(row%3)*10;
         for(let k=0;k<3;k++)B('Timber under stored steel',2.1,.14,.32,x,.12,z-3+k*3,mat('#856844'));
         for(let layer=0;layer<4;layer++)for(let col=0;col<7;col++){
           const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,9,9,1,true),steel);
           pipe.rotation.x=Math.PI/2;pipe.position.set(x+(col-3)*.25,.32+layer*.24,z);yard.add(pipe);
         }
       }
       for(let row=0;row<4;row++){
         const x=-21+row*3.6,z=-35;
         for(let n=0;n<9;n++)B('Steel sheet storage',2.1,.018,6,x,.4+n*.019,z,steel);
       }
       // Parked trailers and trucks form a visible loading queue behind the crane.
       for(let i=0;i<5;i++){
         const x=12+i*5,z=33+i*6;
         B('Waiting truck trailer',2.5,1.3,10,x,1.35,z,mat(i%2?'#b3b8ba':'#cbd1d3'));
         B('Waiting truck cab',2.5,2.5,3.2,x,1.8,z-6.5,mat(i%2?'#477e93':'#f1f2ef'));
         for(const dz of [-4.3,2.9,4.1])for(const dx of [-1.17,1.17]){
           const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.25,12),steel);
           wheel.rotation.z=Math.PI/2;wheel.position.set(x+dx,.57,z+dz);yard.add(wheel);
         }
       }
       for(let i=0;i<10;i++){
         const z=-48+i*10;
         B('Yard perimeter post',.17,3,.17,-56,1.5,z,steel);
         B('Yard perimeter post',.17,3,.17,56,1.5,z,steel);
       }
     }
    function rebuildCargo() {
      if(!root||!cargoGroup)return;
      cargoGroup.clear();
      animatedBundles.length=0;
      animationRef.current.elapsed=0;
      animationRef.current.state='idle';
      if(liftingSlings){liftingSlings.visible=false;liftingSlings.clear();}
      const deckObjects:THREE.Object3D[]=[];
      root.traverse(obj=>{if(/^TRAILER_DECK_PLANK_/.test(obj.name))deckObjects.push(obj);});
      if(!deckObjects.length){setCargoReport('Не найден пол прицепа (TRAILER_DECK_PLANK_).');return;}
      const deck=new THREE.Box3();deckObjects.forEach(obj=>deck.union(new THREE.Box3().setFromObject(obj)));
      const size=deck.getSize(new THREE.Vector3());
      const axis:'x'|'z'=size.z>=size.x?'z':'x';
      const actualLength=axis==='z'?size.z:size.x;
      const actualWidth=axis==='z'?size.x:size.z;
      const cfg=cargoRef.current;
       if (cfg.sandwichItems.length) {
         const bundles = cfg.sandwichItems.flatMap(createSandwichBundles);
         const plan = planSandwichLoading(bundles);
         const firstTruck = plan.trucks[0];
         const scaleL = actualLength / 13.5;
         const scaleW = actualWidth / 2.45;
         const originL = axis==='z' ? deck.min.z : deck.min.x;
         const originW = axis==='z' ? deck.min.x : deck.min.z;
         const panelsById = new Map(cfg.sandwichItems.map(p=>[p.id,p]));
         // RAL 6005 moss green: matte painted steel, with soft natural scene shading.
         const panelGreen = new THREE.MeshStandardMaterial({
           color: '#00533B', roughness: 1, metalness: 0,
         });
         const panelNeutral = new THREE.MeshStandardMaterial({
           color: '#d7d9d4', roughness: 1, metalness: 0,
         });
         const coreMat = new THREE.MeshStandardMaterial({
           color: '#b9b5a5', roughness: 1, metalness: 0,
         });
         const timber = new THREE.MeshStandardMaterial({color:'#a78658',roughness:.9});
         const putBox=(group:THREE.Group,name:string,w:number,h:number,l:number,x:number,y:number,z:number,mat:THREE.Material)=>{
           const mesh=new THREE.Mesh(new THREE.BoxGeometry(axis==='z'?w:l,h,axis==='z'?l:w),mat);
           mesh.name=name;
           mesh.position.set(axis==='z'?x:z,y,axis==='z'?z:x);
           group.add(mesh);
         };
         for(const placement of firstTruck?.placements ?? []) {
           const b=placement.bundle;
           const p=panelsById.get(b.panelId);
           if(!p)continue;
           const group=new THREE.Group();group.name=`Открытая пачка панелей ${b.id}`;
           cargoGroup!.add(group);
           const width=b.widthMm/1000*scaleW;
           const length=b.lengthMm/1000*scaleL;
           const centerX=originW+(placement.xMm+b.widthMm/2)/1000*scaleW;
           const centerZ=originL+(placement.zMm+b.lengthMm/2)/1000*scaleL;
           const baseY=deck.max.y+placement.bottomMm/1000*scaleW;
           const supportHeight=.1*scaleW;
           const layerHeight=p.thicknessMm/1000*scaleW;
           const totalHeight=b.heightMm/1000*scaleW;
           const supportCount=Math.max(2,b.supportCount);
           for(let i=0;i<supportCount;i++){
             const offset=(i/(supportCount-1)-.5)*length*.78;
             putBox(group,'Деревянная опора',width+.035,supportHeight,.12*scaleL,0,supportHeight/2,offset,timber);
           }
           for(let i=0;i<b.quantity;i++){
             const bottom=supportHeight+i*layerHeight;
             putBox(group,`Панель ${i+1}`,width,layerHeight*.94,length,0,bottom+layerHeight/2,0,coreMat);
             const isTopPanel = i === b.quantity - 1;
             putBox(group,'Наружная облицовка',width,.004,length,0,bottom+layerHeight-.002,0,isTopPanel ? panelGreen : panelNeutral);
             putBox(group,'Внутренняя облицовка',width,.004,length,0,bottom+.002,0,panelNeutral);
             // Longitudinal metal seams and edge locks; roof panels have five raised ribs.
             for(const side of [-1,1]){
               putBox(group,'Замковый профиль панели',.018,layerHeight*.72,length,side*(width/2-.009),bottom+layerHeight*.52,0,panelNeutral);
             }
             if(isTopPanel && String(p.panelType)==='ROOF_TRAPEZOID'){
               for(let rib=0;rib<5;rib++){
                 const ribX=(rib/4-.5)*(width-.14);
                 putBox(group,'Трапециевидное ребро кровельной панели',.035,.026,length,ribX,bottom+layerHeight+.013,0,panelGreen);
               }
             }

           }
           // Panels remain fully visible: no shrink film, straps or protective end caps.
           // Wooden supports are kept for realistic transport geometry.
           const destination=new THREE.Vector3(axis==='z'?centerX:centerZ,baseY,axis==='z'?centerZ:centerX);
           const index=animatedBundles.length;
           // Two storage lanes, four positions per lane. Each pack rests on concrete,
           // never starts in the air or intersects another pack.
           const lane=index%2;
           const slot=Math.floor(index/2);
           const localX=4.35 + lane*2.05;
           const localZ=-32 + slot*(Math.max(5.0,length)+1.2);
           const start=craneYard
             ? craneYard.localToWorld(new THREE.Vector3(localX,.20,localZ))
             : new THREE.Vector3(axis==='z'?centerX+5:centerZ+5,deck.min.y+.15,axis==='z'?centerZ:centerX);
           // The group is in world coordinates, with its own bottom at y=0.
           group.position.copy(destination);
           animatedBundles.push({group,destination,start,height:totalHeight});
         }
         const truckCount=plan.trucks.length;
         const previewCount=firstTruck?.placements.length??0;
         const warnings=plan.warnings.join(' ');
         setCargoReport(`Сэндвич-панели · Машин: ${truckCount} · Пачек на показанной шаландe: ${previewCount}/${bundles.length} · Масса всего размещённого груза: ${(plan.totalPlacedWeightKg/1000).toFixed(3)} т · Не размещено: ${plan.rejected.length}. ${truckCount>1?'В 3D показана только первая машина. ':''}${warnings}`);
         return;
       }
       const result=planCargo(cfg.items,cfg.vehicleType);
      const scaleL=actualLength/result.v.length;
      const scaleW=actualWidth/result.v.width;
      const validGeometry=scaleL>0&&scaleW>0;
      if(!validGeometry)return;
      const steel=new THREE.MeshStandardMaterial({color:'#626e78',metalness:.72,roughness:.34});
      const steelEdge=new THREE.MeshStandardMaterial({color:'#36434d',metalness:.66,roughness:.42,side:THREE.DoubleSide});
      const meshMat=new THREE.MeshStandardMaterial({color:'#565b5e',metalness:.75,roughness:.42,side:THREE.DoubleSide});
      const panelMat=new THREE.MeshStandardMaterial({color:'#dce3e7',metalness:.16,roughness:.75});
      const timber=new THREE.MeshStandardMaterial({color:'#96754e',roughness:.9});
      const strap=new THREE.MeshStandardMaterial({color:'#292e31',metalness:.5,roughness:.55});
      const innerLength=Math.min(result.v.length,actualLength-.12);
      const innerWidth=Math.min(result.v.width,actualWidth-.12);
      const originL=(axis==='z'?deck.min.z:deck.min.x)+.06;
      const originW=(axis==='z'?deck.min.x:deck.min.z)+.06;
      const put=(obj:THREE.Object3D,side:number,long:number,height:number)=>{if(axis==='z')obj.position.set(side,height,long);else obj.position.set(long,height,side);cargoGroup!.add(obj);};
      const cube=(w:number,h:number,l:number,side:number,long:number,y:number,mat:THREE.Material)=>{
        const obj=new THREE.Mesh(new THREE.BoxGeometry(axis==='z'?w:l,h,axis==='z'?l:w),mat);put(obj,side,long,y);return obj;
      };
      const cylinder=(r:number,l:number,side:number,long:number,y:number,mat:THREE.Material)=>{
        const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,10),mat);
        obj.rotation[axis==='z'?'x':'z']=Math.PI/2;put(obj,side,long,y);return obj;
      };
      let drawn=0;
      for(const pack of result.placed){
        const firstCargoChild=cargoGroup.children.length;
        const l=pack.length*scaleL,w=pack.width*scaleW;
        const sx=originW+(pack.x+pack.width/2)*scaleW;
        const sz=originL+(pack.z+pack.length/2)*scaleL;
        const top=deck.max.y+pack.layer*scaleW;
        const supports=[-.32,.32];
        if(pack.item.type!=='Лист')for(const t of supports)cube(w+.06,.09,.11,sx,sz+t*l,top+.045,timber);
        const bottom=top+.09;
        const type=pack.item.type;
        if(type==='Лист'){
          for(let n=0;n<pack.quantity;n++)cube(w,Math.max(.001,pack.item.wall/1000*scaleW),l,sx,sz,top+(n+.5)*pack.item.wall/1000*scaleW,steel);
        }else if(type==='Арматура'){
          // Each real bundle has a circular cross-section and its own timber supports.
          // Diameter is calculated from the number of bars and packing density.
          const d=Math.max(.006,pack.item.diameter/1000);
          const physicalBars=pack.quantity;
          const physicalRadius=(d/2)*Math.sqrt(physicalBars/.80);
          const radius=Math.min(physicalRadius,w/2);
          const centerY=bottom+radius+.012;
          const drawCount=Math.min(600,physicalBars);
          const rodRadius=d/2;
          const rodGeometry=new THREE.CylinderGeometry(rodRadius,rodRadius,l-.025,7);
          if(axis==='z')rodGeometry.rotateX(Math.PI/2);
          else rodGeometry.rotateZ(Math.PI/2);
          const rods=new THREE.InstancedMesh(rodGeometry,steel,drawCount);
          rods.name=`ПАЧКА_${pack.index}_ПОЗИЦИЯ_${pack.item.id}`;
          rods.frustumCulled=false;
          const dummy=new THREE.Object3D();
          // Golden-angle disk samples remain round even for very large bar counts.
          for(let j=0;j<drawCount;j++){
            const a=j*2.399963229728653;
            const r=Math.sqrt((j+.5)/drawCount)*Math.max(.001,radius-rodRadius);
            const cross=Math.cos(a)*r;
            const vertical=Math.sin(a)*r;
            dummy.position.set(axis==='z'?sx+cross:sz,centerY+vertical,axis==='z'?sz:sx+cross);
            dummy.updateMatrix();rods.setMatrixAt(j,dummy.matrix);
          }
          rods.instanceMatrix.needsUpdate=true;cargoGroup.add(rods);
          // Wire wraps the outer envelope, in a plane perpendicular to the rods.
          for(const t of [-.36,-.12,.12,.36]){
            const wire=new THREE.Mesh(new THREE.TorusGeometry(radius+.009,.0045,7,48),strap);
            wire.name=`НАРУЖНАЯ_ОБВЯЗКА_${pack.index}`;
            if(axis==='z')wire.position.set(sx,centerY,sz+t*l);
            else {wire.rotation.y=Math.PI/2;wire.position.set(sz+t*l,centerY,sx);}
            cargoGroup.add(wire);
          }
        }else if(type==='Уголки'){
          // Individual nested V profiles, with straight aligned ends and a compact
          // cross-section. No full-width serrated slab or overlapping profiles.
          const span=Math.max(pack.item.profileWidth,pack.item.profileHeight)/1000*scaleW;
          const thickness=Math.max(.001,pack.item.wall/1000*scaleW);
          const cols=Math.max(1,Math.min(pack.quantity,Math.round(w/span)));
          const rows=Math.ceil(pack.quantity/cols);
          const rise=span/2;
          const half=span/2;
          const pitch=Math.max(thickness*2.2,span*.12);
          const inset=Math.min(thickness*.85,span*.12);
          const cross=new THREE.Shape();
          cross.moveTo(-half,0);
          cross.lineTo(0,rise);
          cross.lineTo(half,0);
          cross.lineTo(half-inset,0);
          cross.lineTo(0,rise-inset);
          cross.lineTo(-half+inset,0);
          cross.closePath();
          const geom=new THREE.ExtrudeGeometry(cross,{depth:l,bevelEnabled:false,steps:1});
          geom.translate(0,0,-l/2);
          if(axis==='x')geom.rotateY(Math.PI/2);
          const angleMat=new THREE.MeshStandardMaterial({color:'#747b80',metalness:.48,roughness:.76,side:THREE.DoubleSide});
          const angles=new THREE.InstancedMesh(geom,angleMat,pack.quantity);
          angles.name=`Пачка уголков ${pack.index} — компактные вложенные профили`;
          angles.frustumCulled=false;
          const dummy=new THREE.Object3D();
          for(let n=0;n<pack.quantity;n++){
            const col=n%cols,row=Math.floor(n/cols);
            const crossPos=(col-(cols-1)/2)*span;
            dummy.position.set(axis==='z'?sx+crossPos:sz,bottom+row*pitch,axis==='z'?sz:sx+crossPos);
            dummy.updateMatrix();angles.setMatrixAt(n,dummy.matrix);
          }
          angles.instanceMatrix.needsUpdate=true;
          cargoGroup.add(angles);
          // Two complete dark steel bands, wrapped around the bundle at 25/75%
          // of its length, with vertical side segments and bottom returns.
          const bundleHeight=rise+(rows-1)*pitch;
          const bandThickness=Math.max(.012,Math.min(.024,span*.22));
          const bandWidth=.045;
          for(const station of [-.25,.25]){
            const longitudinal=sz+station*l;
            const bandTop=bottom+bundleHeight+.009;
            const sideHeight=bundleHeight+.024;
            cube(w+.028,bandThickness,bandWidth,sx,longitudinal,bandTop,strap);
            cube(w+.028,bandThickness,bandWidth,sx,longitudinal,bottom-.016,strap);
            for(const side of [-1,1])cube(bandThickness,sideHeight,bandWidth,sx+side*(w/2+.014),longitudinal,bottom+bundleHeight/2,strap);
          }
        }else if(type==='Трубы'){
           const a=(pack.item.shape==='round'?pack.item.diameter:pack.item.profileWidth)/1000*scaleW;
           const b=(pack.item.shape==='round'?pack.item.diameter:pack.item.profileHeight)/1000*scaleW;
           const wall=pack.item.wall/1000*scaleW;
           const countX=Math.max(1,Math.round(pack.width/Math.max(.001,a))); 
           const countY=Math.ceil(pack.quantity/countX);
           const tubeShape=new THREE.Shape();
           if(pack.item.shape!=='round'){
             tubeShape.moveTo(-a/2,-b/2);tubeShape.lineTo(a/2,-b/2);tubeShape.lineTo(a/2,b/2);tubeShape.lineTo(-a/2,b/2);tubeShape.closePath();
             const hole=new THREE.Path();hole.moveTo(-a/2+wall,-b/2+wall);hole.lineTo(-a/2+wall,b/2-wall);hole.lineTo(a/2-wall,b/2-wall);hole.lineTo(a/2-wall,-b/2+wall);hole.closePath();tubeShape.holes.push(hole);
           }
           const geometry=pack.item.shape==='round'?new THREE.RingGeometry(Math.max(.001,a/2-wall),a/2,20):new THREE.ShapeGeometry(tubeShape);
           const shell=pack.item.shape==='round'?new THREE.CylinderGeometry(a/2,a/2,l,20,1,true):new THREE.ExtrudeGeometry(tubeShape,{depth:l,bevelEnabled:false,steps:1});
           if(pack.item.shape==='round') { if(axis==='z')shell.rotateX(Math.PI/2); else shell.rotateZ(Math.PI/2); }
           else {shell.translate(0,0,-l/2);if(axis==='x')shell.rotateY(Math.PI/2);}
           const sideMat=new THREE.MeshStandardMaterial({color:'#667782',metalness:.78,roughness:.29,side:THREE.DoubleSide});
           for(let row=0;row<countY;row++)for(let col=0;col<countX;col++){
             if(row*countX+col>=pack.quantity)continue;
             const px=sx+(col-(countX-1)/2)*a;
             const py=bottom+b/2+row*b;
             const tube=new THREE.Mesh(shell,sideMat);
             put(tube,px,sz,py);
             tube.name=pack.item.shape==='round'?'Круглая полая труба':'Полая профильная труба';
             if(pack.item.shape==='round')for(const end of [-1,1]){
               const ring=new THREE.Mesh(geometry,steelEdge);
               if(axis==='z')ring.position.set(px,py,sz+end*l/2);
               else{ring.rotation.y=Math.PI/2;ring.position.set(sz+end*l/2,py,px);}
               cargoGroup!.add(ring);
             }
           }
           // Only PROFILE tubes are strapped; ROUND tubes are always loose.
           if(pack.item.shape!=='round')for(const offset of [-.30,.30]){
             const band=new THREE.Mesh(new THREE.BoxGeometry(axis==='z'?w+.02:.025,.015,axis==='z'?.025:w+.02),strap);
             put(band,sx,sz+offset*l,bottom+pack.height*scaleW+.02);
           }
        }else if(type==='Сварная сетка'){
          const layers=Math.max(3,Math.min(16,Math.round(pack.height/.045)));
          const span=Math.max(.10,Math.min(.22,w/8));
          for(let layer=0;layer<layers;layer++){
            const yy=bottom+.018+layer*.035;
            for(let x=-w/2;x<=w/2+.001;x+=span)cube(.009,.009,l,sx+x,sz,yy,meshMat);
            for(let z=-l/2;z<=l/2+.001;z+=span)cube(w,.009,.009,sx,sz+z,yy+.01,meshMat);
          }
        }else{
          const h=Math.max(.12,Math.min(pack.height,1.8));
          cube(w,h,l,sx,sz,bottom+h/2,type==='Сэндвич-панели'?panelMat:steel);
          if(type==='Сэндвич-панели'){
            for(let i=1;i<Math.min(14,Math.ceil(h/.09));i++)cube(w+.008,.009,l+.005,sx,sz,bottom+i*h/Math.ceil(h/.09),steelEdge);
          }
        }
        // Preserve the original geometry but animate it as one rigid cargo unit.
        const destination=new THREE.Vector3(axis==='z'?sx:sz,top,axis==='z'?sz:sx);
        const unit=new THREE.Group();
        unit.name=`CRANE_LOAD_${drawn+1}_${type}`;
        const created=cargoGroup.children.slice(firstCargoChild);
        for(const obj of created){
          cargoGroup.remove(obj);
          obj.position.sub(destination);
          unit.add(obj);
        }
        cargoGroup.add(unit);
        unit.position.copy(destination);
        const box=new THREE.Box3().setFromObject(unit);
        const height=Math.max(.12,box.max.y-destination.y);
        const index=animatedBundles.length;
        const lane=index%2;
        const slot=Math.floor(index/2);
        const localX=4.35+lane*2.05;
        const localZ=-32+slot*(Math.max(5,l)+1.2);
        const start=craneYard
          ? craneYard.localToWorld(new THREE.Vector3(localX,.20,localZ))
          : destination.clone().add(new THREE.Vector3(5,-top+.2,0));
        animatedBundles.push({group:unit,destination,start,height});
        drawn++;
      }
      const totalPacks=result.all.length;
      const placedWeight=result.total.toFixed(3);
      const extra=result.rejected.length;
      const recommended=extra?Math.max(2,Math.ceil(result.all.reduce((sum,p)=>sum+p.weight,0)/result.v.payload)):1;
      setCargoReport(`${cfg.items.some(isPrimaryOversized) ? OVERSIZED_NOTICE + '. ' : ''}Машина: ${cfg.vehicleType} · Позиций: ${cfg.items.length} · Грузовых групп: ${drawn}/${totalPacks} · Общая масса в кузове: ${placedWeight} из ${result.v.payload} т · Заявлено: ${result.requested.toFixed(3)} т.${extra?` НЕ ПОМЕСТИЛОСЬ: ${extra} пач. Ориентир: ${recommended} машины (нужна повторная раскладка и проверка осей).`:' Предварительно помещается по массе и габаритам; крепление, устойчивость штабелей и осевые нагрузки требуют проверки.'}`);
    }
    const onPointerDown=(event:PointerEvent)=>{pointerDown={x:event.clientX,y:event.clientY};};
    const onPointerUp=(event:PointerEvent)=>{
      if(!pointerDown||!root||!objects)return;
      const move=Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y);
      pointerDown=null;if(move>5)return;
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObject(root,true)[0];
      if(!hit)return;
      let current:THREE.Object3D|null=hit.object;
      while(current && current!==root){
        const match=/^TRAILER_SIDE_(LEFT|RIGHT)_(\d{2})_PIVOT$/.exec(current.name);
        if(match){const id=boardId(match[1] as Side,match[2]);setOpenBoards(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});return;}
        if(current.name==='TRAILER_REAR_GATE_PIVOT') {setRearOpen(old=>!old);return;}
        current=current.parent;
      }
    };
    renderer.domElement.addEventListener('pointerdown',onPointerDown);
    renderer.domElement.addEventListener('pointerup',onPointerUp);


    const measure = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (!alive) return;
        root = gltf.scene;
        scene.add(root);
        objects = parseModel(root);
        cargoGroup = new THREE.Group(); cargoGroup.name='PREVIEW_CARGO_REBAR'; scene.add(cargoGroup);
        rebuildCargoRef.current=rebuildCargo;
        setAvailableBoards(objects.boards.size);
        setAvailableStakes(objects.stakes.size);

        const box = new THREE.Box3().setFromObject(root);
        if (box.isEmpty()) {
          setError('В файле GLB нет видимой геометрии. Проверьте экспорт из Blender.');
          setLoading(false);
          return;
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const dominant = Math.max(size.x, size.y, size.z, 5);
        const defaultTarget = center.clone();
        const defaultPosition = center.clone().add(new THREE.Vector3(dominant * 1.05, dominant * 0.78, dominant * 1.25));
        const distance = defaultPosition.distanceTo(center);
        controls.target.copy(defaultTarget);
        controls.minDistance = Math.max(0.8, dominant * 0.11);
        controls.maxDistance = Math.max(90, dominant * 6);
        camera.near = Math.max(0.01, distance / 1000);
        camera.far = Math.max(250, distance * 18);
        camera.updateProjectionMatrix();
        camera.position.copy(defaultPosition);
        controls.update();

        grid.position.y = box.min.y - 0.04;
        grid.visible = false;
        const deckPieces:THREE.Object3D[]=[];
        root.traverse(obj=>{if(/^TRAILER_DECK_PLANK_/.test(obj.name))deckPieces.push(obj);});
        const trailerBox=new THREE.Box3();
        deckPieces.forEach(obj=>trailerBox.union(new THREE.Box3().setFromObject(obj)));
        const yardCenter=trailerBox.isEmpty()?center:trailerBox.getCenter(new THREE.Vector3());
        createYard(box.min.y, yardCenter, size.z>=size.x?'z':'x');
        rebuildCargo();
        viewResetRef.current = () => {
          camera.position.copy(defaultPosition);
          controls.target.copy(defaultTarget);
          controls.update();
        };
        setLoading(false);
        setProgress(100);
      },
      (event) => {
        if (alive && event.total > 0) {
          setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      },
      (loadError) => {
        if (alive) {
          setLoading(false);
          setError(`Ошибка загрузки GLB: ${getFailedMessage(loadError)}. Убедитесь, что файл находится в public/models/maz-with-trailer.glb.`);
        }
      },
    );

    const render = () => {
      if (!alive) return;
      animationFrame = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), 0.06);
      const desired = desiredRef.current;

      if (objects) {
        objects.boards.forEach((board, id) => {
          const target = board.angle + (desired.openBoards.has(id) ? board.sign : 0);
          board.object.rotation.z = THREE.MathUtils.damp(board.object.rotation.z, target, 8, delta);
        });
        objects.stakes.forEach((stake, id) => {
          stake.object.visible = !desired.hiddenStakes.has(id);
        });
        if (objects.rear) {
          const target = objects.rear.angle + (desired.rearOpen ? REAR_GATE_ANGLE : 0);
          objects.rear.object.rotation.x = THREE.MathUtils.damp(objects.rear.object.rotation.x, target, 8, delta);
        }
      }
      if (animatedBundles.length && animationRef.current.state==='playing') {
        animationRef.current.elapsed += delta * animationRef.current.speed;
        const cycle = 24;
        const index = Math.min(animatedBundles.length - 1, Math.floor(animationRef.current.elapsed / cycle));
        const phase = THREE.MathUtils.clamp((animationRef.current.elapsed - index * cycle) / cycle, 0, 1);
        const smooth = (value:number) => {
          const t = THREE.MathUtils.clamp(value,0,1);
          return t*t*(3-2*t);
        };
        for (let i=0;i<animatedBundles.length;i++) {
          const item=animatedBundles[i];
          if(i<index) item.group.position.copy(item.destination);
          else if(i>index) item.group.position.copy(item.start);
          else {
            const source=item.start;
            const target=item.destination;
            const previous=index>0?animatedBundles[index-1].destination:source;
            const clearance=yardGround+9.65;
            const p=source.clone();
            let craneAt=source.clone();
            let hookY=clearance;
            if(phase<.14){
              // Travel to the storage bay with the hook raised.
              craneAt.lerpVectors(previous,source,smooth(phase/.14));
            }else if(phase<.26){
              // Lower cable vertically to the resting bundle.
              hookY=THREE.MathUtils.lerp(clearance,source.y+item.height+1.65,smooth((phase-.14)/.12));
            }else if(phase<.40){
              // Lift the bundle with the cable; no horizontal movement yet.
              p.y=THREE.MathUtils.lerp(source.y,clearance-item.height-1.65,smooth((phase-.26)/.14));
              hookY=p.y+item.height+1.65;
            }else if(phase<.69){
              // Gantry rolls along the rails and trolley crosses the span.
              p.lerpVectors(source,target,smooth((phase-.40)/.29));
              p.y=clearance-item.height-1.65;
              craneAt.copy(p);
              hookY=p.y+item.height+1.65;
            }else if(phase<.86){
              // Lower onto timber supports on the trailer.
              p.copy(target);
              p.y=THREE.MathUtils.lerp(clearance-item.height-1.65,target.y,smooth((phase-.69)/.17));
              craneAt.copy(target);
              hookY=p.y+item.height+1.65;
            }else{
              // Unhook and retract cable, leaving the pack in place.
              p.copy(target);
              craneAt.copy(target);
              hookY=THREE.MathUtils.lerp(target.y+item.height+1.65,clearance,smooth((phase-.86)/.14));
            }
            item.group.position.copy(p);
            // Fit textile lifting straps to the actual dimensions and top of this bundle.
            // All strap geometry is in hook-local coordinates, and follows the hook continuously.
            if((craneRig && craneHook && craneCable && craneTrolley) || importedCraneReady){
              if (!importedCraneReady) {
                craneHook!.visible=true;
                craneCable!.visible=true;
                craneTrolley!.visible=true;
              }
              cranePose(craneAt,hookY);
            }
            // Rigging is built from the current cargo bounds in WORLD coordinates.
            // Beam follows the length (Z) of the rebar, not its cross-section.
            if (!importedCraneReady && liftingSlings && slingMaterial && craneHook && phase>=.24 && phase<.86) {
              // Dispose previous frame's geometries before rebuilding.
              liftingSlings.children.forEach(child => child.traverse(obj => {
                if (obj instanceof THREE.Mesh) obj.geometry.dispose();
              }));
              liftingSlings.clear();
              item.group.updateWorldMatrix(true,true);
              craneHook.updateWorldMatrix(true,true);
              const bounds = new THREE.Box3().setFromObject(item.group);
              const center = bounds.getCenter(new THREE.Vector3());
              const size = bounds.getSize(new THREE.Vector3());
              const hookCenter = craneHook.getWorldPosition(new THREE.Vector3());
              const beamY = hookCenter.y - .99;
              const beamHalf = Math.max(.48,Math.min(size.z*.32,2.4));
              const slingZ = Math.max(.30,Math.min(size.z*.29,beamHalf-.12));
              const strapX = Math.max(.13,size.x*.5+.07);
              const topY = bounds.max.y+.07;
              const bottomY = bounds.min.y-.065;
              const beamMat = new THREE.MeshStandardMaterial({color:'#e7a928',metalness:.55,roughness:.35});
              const steelMat = new THREE.MeshStandardMaterial({color:'#343e48',metalness:.7,roughness:.3});
              const addSegment = (name:string,a:THREE.Vector3,b:THREE.Vector3,radius:number,material:THREE.Material) => {
                const vector=b.clone().sub(a);
                if(vector.length()<.025)return;
                const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,vector.length(),10),material);
                mesh.name=name;
                mesh.position.copy(a).add(b).multiplyScalar(.5);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());
                mesh.castShadow=true;
                liftingSlings!.add(mesh);
              };
              // The shackle hangs below the hook; two suspension legs support the beam.
              const master=new THREE.Vector3(hookCenter.x,hookCenter.y-.69,hookCenter.z);
              const beamCenter=new THREE.Vector3(center.x,beamY,center.z);
              addSegment('Master link to hook',master,master.clone().add(new THREE.Vector3(0,-.12,0)),.055,steelMat);
              for(const sign of [-1,1]){
                const beamEnd=beamCenter.clone().add(new THREE.Vector3(0,0,sign*beamHalf));
                addSegment('Upper suspension chain',master,beamEnd.clone().add(new THREE.Vector3(0,.09,0)),.027,steelMat);
              }
              addSegment('Spreader beam',beamCenter.clone().add(new THREE.Vector3(0,0,-beamHalf)),beamCenter.clone().add(new THREE.Vector3(0,0,beamHalf)),.075,beamMat);
              // Each textile basket passes below the bundle, with its two ends
              // secured at the beam. Nothing passes through the steel itself.
              for(const sign of [-1,1]){
                const z=center.z+sign*slingZ;
                const eye=new THREE.Vector3(center.x,beamY,z);
                const leftTop=new THREE.Vector3(center.x-strapX,topY,z);
                const leftBottom=new THREE.Vector3(center.x-strapX,bottomY,z);
                const rightBottom=new THREE.Vector3(center.x+strapX,bottomY,z);
                const rightTop=new THREE.Vector3(center.x+strapX,topY,z);
                addSegment('Basket sling left leg',eye,leftTop,.038,slingMaterial);
                addSegment('Basket sling left wrap',leftTop,leftBottom,.038,slingMaterial);
                addSegment('Basket sling under cargo',leftBottom,rightBottom,.038,slingMaterial);
                addSegment('Basket sling right wrap',rightBottom,rightTop,.038,slingMaterial);
                addSegment('Basket sling right leg',rightTop,eye,.038,slingMaterial);
              }
              const horizontalGap=Math.hypot(hookCenter.x-center.x,hookCenter.z-center.z);
              liftingSlings.visible=horizontalGap<.65 && beamY>topY+.20;
            } else if(liftingSlings) {
              liftingSlings.visible=false;
            }
          }
        }
        if(animationRef.current.elapsed >= animatedBundles.length*cycle){
          animatedBundles.forEach(item=>item.group.position.copy(item.destination));
          if(craneHook)craneHook.visible=true;
          getImportedCraneMixer()?.setTime(0);
          if(liftingSlings)liftingSlings.visible=false;
          if(craneCable)craneCable.visible=true;
          if(craneTrolley)craneTrolley.visible=true;
          animationRef.current.state='idle';setAnimationState('idle');
        }
      }
      updateWebRopes();
      controls.update(delta);
      renderer.render(scene, camera);
    };
    render();

    return () => {
      alive = false;
      animationRestartRef.current=null;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      rebuildCargoRef.current=null;
      renderer.domElement.removeEventListener('pointerdown',onPointerDown);
      renderer.domElement.removeEventListener('pointerup',onPointerUp);
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      viewResetRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, []);

  function toggleBoard(id: BoardId) {
    setOpenBoards((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllBoards(side: Side, open: boolean) {
    setOpenBoards((old) => {
      const next = new Set(old);
      SECTIONS.forEach((number) => {
        const id = boardId(side, number);
        if (open) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  function setAllStakes(visible: boolean) {
    if (visible) setHiddenStakes(new Set());
    else {
      const everyStake = new Set<string>();
      (['LEFT', 'RIGHT'] as const).forEach((side) => {
        STAKE_NUMBERS.forEach((number) => everyStake.add(stakeId(side, number)));
      });
      setHiddenStakes(everyStake);
    }
  }

  function toggleStake(id: string) {
    setHiddenStakes((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetConfiguration() {
    setOpenBoards(new Set());
    setHiddenStakes(new Set());
    setRearOpen(false);
    setRotate(false);
    viewResetRef.current?.();
  }

  const visibleStakes = Math.max(0, availableStakes - hiddenStakes.size);
  const canControl = !loading && !error;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}><span className={styles.statusDot} /> Локальный стенд · не опубликовано</div>
          <h1 className={styles.title}>Визуализация погрузки</h1>
          <p className={styles.description}>МАЗ с бортовым полуприцепом · Проверка 3D-модели перед размещением на сайте</p>
        </div>
        <button className={styles.resetButton} type="button" onClick={resetConfiguration} disabled={!canControl}>
          ↺ Сбросить положение
        </button>
      </div>

      <section style={{background:'#fff',border:'1px solid #d9e2eb',borderRadius:18,padding:20,margin:'18px 0'}}>
        <h2 style={{fontSize:20,margin:'0 0 8px'}}>Умная комплектация — тестовая версия</h2>
        <p style={{color:'#60758b',fontSize:13}}>Добавляйте несколько позиций. Шаланда: 13,5 × 2,45 м, 20 т. Арматура — пачки до 5 т. Количество труб в пачке определяется обновлённой базой по вручную введённым размерам и толщине. Крепление и осевые нагрузки требуют отдельной проверки.</p>
          <label>Груз<select value={cargoType} onChange={e=>setCargoType(e.target.value)} style={{display:'block',width:'100%',padding:9}}>{['Арматура','Трубы','Лист','Уголки','Сэндвич-панели'].map(v=><option key={v}>{v}</option>)}</select></label>
        {cargoType==='Сэндвич-панели' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,marginTop:14}}>
            <label>Длина, м<input type="number" min="0.1" max="14" step="0.1" value={sandwichLength} onChange={e=>setSandwichLength(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
            <label>Ширина, мм<input type="number" min="100" max="2450" value={sandwichWidth} onChange={e=>setSandwichWidth(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
            <label>Тип панели<select value={sandwichPanelType} onChange={e=>setSandwichPanelType(e.target.value as 'wall'|'roof')} style={{display:'block',width:'100%',padding:9}}><option value="wall">Стеновая</option><option value="roof">Кровельная</option></select></label>
            <label>Утеплитель<select value={sandwichInsulation} onChange={e=>setSandwichInsulation(e.target.value as SandwichPanel['insulation'])} style={{display:'block',width:'100%',padding:9}}><option value="EPS">Пенополистирол (ППС)</option><option value="PIR_PUR">PIR / PUR</option><option value="MINERAL_WOOL">Минеральная вата (базальт)</option></select></label>
            <label>Толщина, мм<select value={sandwichThickness} onChange={e=>setSandwichThickness(e.target.value)} style={{display:'block',width:'100%',padding:9}}>{[50,60,80,100,120,150,200,250].map(n=><option key={n} value={n}>{n} мм</option>)}</select></label>
            <label>Панелей в пачке, шт.<input type="number" min="1" max="1000" step="1" value={sandwichBundleCapacity} onChange={e=>setSandwichBundleCapacity(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
            <label>Способ расчёта<select value={sandwichInputMode} onChange={e=>{const mode=e.target.value as 'quantity'|'weight'|'m2'|'m3';setSandwichInputMode(mode);setSandwichInputValue(mode==='quantity'?'25':mode==='weight'?'2.5':mode==='m2'?'150':'15');}} style={{display:'block',width:'100%',padding:9}}><option value="weight">По весу, т</option><option value="quantity">По количеству, шт.</option><option value="m2">По площади, м²</option><option value="m3">По объёму, м³</option></select></label>
            <label>{sandwichInputMode==='quantity'?'Количество, шт.':sandwichInputMode==='weight'?'Масса, т':sandwichInputMode==='m2'?'Площадь, м²':'Объём, м³'}<input type="number" min="0" step={sandwichInputMode==='quantity'?'1':'0.01'} value={sandwichInputValue} onChange={e=>setSandwichInputValue(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
            <div style={{gridColumn:'1/-1',fontSize:13,background:'#edf5f8',padding:12,borderRadius:8}}>
              <strong>{`${sandwichAreaM2.toFixed(2)} м² · ${sandwichVolumeM3.toFixed(3)} м³`}</strong> · {sandwichQuantity} шт. · {sandwichBundlesPreview.length} пач. · {(sandwichBundlesPreview.reduce((sum,b)=>sum+b.weightKg,0)/1000).toFixed(3)} т.
              <div style={{marginTop:7,color:'#334c61'}}>Полных пачек: {sandwichBundlesPreview.filter(b=>b.fullBundle).length} · Неполных: {sandwichBundlesPreview.filter(b=>!b.fullBundle).length} · В полной пачке: {sandwichBundleCapacity} шт.</div>
              {sandwichBundlesPreview.length>0&&<div style={{marginTop:6,color:'#334c61'}}>Масса полной пачки: {(sandwichUnitWeight*Number(sandwichBundleCapacity)/1000).toFixed(3)} т · Площадь полной пачки: {(sandwichPanelArea*Number(sandwichBundleCapacity)).toFixed(2)} м² · Объём полной пачки: {(sandwichPanelVolume*Number(sandwichBundleCapacity)).toFixed(3)} м³</div>}
              {sandwichBundlesPreview.some(b=>!b.fullBundle)&&<div style={{marginTop:6,color:'#334c61'}}>Последняя неполная пачка: {sandwichBundlesPreview.at(-1)?.quantity} шт. · {((sandwichBundlesPreview.at(-1)?.weightKg??0)/1000).toFixed(3)} т · {(sandwichPanelArea*(sandwichBundlesPreview.at(-1)?.quantity??0)).toFixed(2)} м² · {(sandwichPanelVolume*(sandwichBundlesPreview.at(-1)?.quantity??0)).toFixed(3)} м³</div>}
              <div style={{marginTop:5,color:'#5e7182'}}>Утеплитель: {sandwichInsulationLabel}, расчётная плотность {sandwichInsulationDensity} кг/м³. Указанный ориентир: {sandwichReferenceWeight} (зависит от толщины панели и облицовок). Расчётная масса: {(sandwichUnitWeight/Math.max(sandwichPanelArea,0.000001)).toFixed(2)} кг/м². Облицовки 0,5 мм, RAL 6005 (зелёный мох). Площадь считается по фактической ширине. При расчёте по массе количество округляется вниз до целых панелей.</div>
            </div>
          </div>
        ) :         <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10}}>
          <label>Машина<select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} style={{display:'block',width:'100%',padding:9}}>{Object.keys(VEHICLES).map(v=><option key={v}>{v}</option>)}</select></label>

          {cargoType==='Арматура'&&<label>Диаметр, мм<select value={rebarDiameter} onChange={e=>setRebarDiameter(e.target.value)} style={{display:'block',width:'100%',padding:9}}>{[6,8,10,12,14,16,18,20,22,25,28,32,36,40,45,50,55,60,65,70].map(v=><option key={v}>{v}</option>)}</select></label>}
           {cargoType==='Трубы'&&<>
             <label>Форма трубы<select value={pipeShape} onChange={e=>setPipeShape(e.target.value as 'round'|'square'|'rect')} style={{display:'block',width:'100%',padding:9}}><option value="round">Круглая</option><option value="rect">Профильная</option></select></label>
             {pipeShape==='round'&&<label>Наружный диаметр, мм<input type="number" min="1" value={pipeDiameter} onChange={e=>setPipeDiameter(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>}
             {pipeShape!=='round'&&<>
               <label>Ширина профиля, мм<input type="number" min="1" value={pipeRectWidth} onChange={e=>setPipeRectWidth(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
               <label>Высота профиля, мм<input type="number" min="1" value={pipeRectHeight} onChange={e=>setPipeRectHeight(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
             </>}
           </>}
          {cargoType==='Уголки'&&<>
            <label>Стандарт уголка<select value={angleStandard} onChange={e=>{const kind=e.target.value as AngleStandard;setAngleStandard(kind);setAngleA(kind==='equal'?'75':'75');setAngleB(kind==='equal'?'75':'50');setAngleThickness(kind==='equal'?'6':'5');}} style={{display:'block',width:'100%',padding:9}}><option value="equal">Равнополочный — ГОСТ 8509-93</option><option value="unequal">Неравнополочный — ГОСТ 8510-86</option></select></label>
            <label>Размер полок, мм<select value={`${angleA}x${angleB}`} onChange={e=>{const [a,b]=e.target.value.split('x').map(Number);setAngleA(String(a));setAngleB(String(b));const row=ANGLE_CATALOG.find(r=>r.kind===angleStandard&&r.a===a&&r.b===b);if(row)setAngleThickness(String(row.t));}} style={{display:'block',width:'100%',padding:9}}>{angleSizes.map(r=><option key={`${r.a}x${r.b}`} value={`${r.a}x${r.b}`}>{r.a} × {r.b}</option>)}</select></label>
            <label>Толщина уголка, мм<select value={angleThickness} onChange={e=>setAngleThickness(e.target.value)} style={{display:'block',width:'100%',padding:9}}>{ANGLE_CATALOG.filter(r=>r.kind===angleStandard&&r.a===Number(angleA)&&r.b===Number(angleB)).map(r=><option key={r.t} value={r.t}>{r.t}</option>)}</select></label>
            {angleRow&&<div style={{gridColumn:'1/-1',padding:10,background:'#edf5f8',borderRadius:8,fontSize:13}}>{angleRow.estimated ? "Расчётная масса (приблизительно): " : "По исходной таблице: "}{angleRow.kgPerM.toFixed(angleRow.estimated ? 3 : 2)} кг/м · 6 м: {angleRow.pack6} шт. · 11,7 м: {angleRow.pack117} шт. · Для длины {cargoLength} м: <b>{angleCapacity} шт. в пачке</b> (не более 5 т). {angleRow.estimated && "Для нового типоразмера массу и упаковку необходимо уточнить у поставщика."}</div>}
          </>}
          <label>Длина, м<input type="number" min=".1" step=".1" value={cargoLength} onChange={e=>setCargoLength(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>
          {cargoType==='Лист'&&<><label>Ширина листа, м<input type="number" min=".1" step=".1" value={cargoWidth} onChange={e=>setCargoWidth(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label></>}
          {cargoType==='Трубы'&&<label>Толщина стенки, мм<input type="number" min=".1" step=".1" value={wallThickness} onChange={e=>setWallThickness(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>}
          {cargoType==='Лист'&&<label>Толщина листа, мм<input type="number" min=".1" step=".1" value={wallThickness} onChange={e=>setWallThickness(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>}
          <label>Способ ввода<select value={entryMode} onChange={e=>setEntryMode(e.target.value as 'weight'|'quantity')} style={{display:'block',width:'100%',padding:9}}><option value="weight">По весу</option><option value="quantity">По количеству штук</option></select></label>
          {entryMode==='weight'?<label>Желаемый вес, т<input type="number" min=".001" step=".1" value={cargoWeight} onChange={e=>setCargoWeight(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>:<label>Количество, шт.<input type="number" min="1" step="1" value={cargoQuantity} onChange={e=>setCargoQuantity(e.target.value)} style={{display:'block',width:'100%',padding:9}}/></label>}
          {usingCatalog&&packOptions.length>1&&<label style={{gridColumn:'1/-1'}}>Количество труб в пачке<select value={currentBundleSize} onChange={e=>setPackChoice(Number(e.target.value))} style={{display:'block',width:'100%',padding:9}}>{packOptions.map(count=><option key={count} value={count}>{count} шт.</option>)}</select></label>}
          <div style={{gridColumn:'1/-1',fontSize:13,background:'#edf5f8',padding:10,borderRadius:8}}>Масса 1 шт.: {currentUnitWeight.toFixed(5)} т · Количество: {Number.isFinite(currentQuantity)?currentQuantity:'—'} шт. · Фактическая масса: {Number.isFinite(currentActualWeight)?currentActualWeight.toFixed(3):'—'} т {entryMode==='weight'?'(округление до целых изделий)':''}{cargoType==='Уголки'&&currentQuantity>0?` · Пачек до 5 т: ${angleCapacity>0?Math.ceil(currentQuantity/angleCapacity):'—'}`:''}{cargoType==='Трубы'&&currentQuantity>0?(pipeShape==='round'?'':` · В пачке: ${currentBundleSize} шт. · Пачек: ${Math.ceil(currentQuantity/currentBundleSize)}`):''}</div>
        </div>}
        {formError&&<p style={{color:'#b42318'}}>{formError}</p>}
        <button type="button" onClick={cargoType==='Сэндвич-панели'?addSandwichItem:addItem} style={{marginTop:14,padding:'11px 16px',border:0,borderRadius:9,background:'#263f55',color:'white',cursor:'pointer'}}>+ Добавить позицию</button>
        <button type="button" onClick={()=>{setItems([]);setSandwichItems([]);setFormError('');}} style={{marginLeft:9,padding:'11px 16px',border:'1px solid #cbd5e1',borderRadius:9,background:'white',cursor:'pointer'}}>Очистить</button>
        <div style={{marginTop:12,display:'flex',gap:7,flexWrap:'wrap'}}>{items.map(item=><button key={item.id} onClick={()=>setItems(old=>old.filter(v=>v.id!==item.id))} title="Удалить позицию" style={{border:'1px solid #d5e0e9',borderRadius:9,padding:'8px 10px',background:'#f5f8fb',cursor:'pointer'}}>{item.type==='Трубы' ? item.shape==='round'?`Ø${item.diameter} мм`:`${item.profileWidth}×${item.profileHeight} мм · ${Math.ceil(item.quantity/tubesPerBundle(item))} пач. по ${tubesPerBundle(item)} шт.` : item.type==='Уголки'?`Уголок ${item.angleA}×${item.angleB}×${item.wall} мм`:item.type} · {item.quantity} шт. · {item.length} м · {item.weight.toFixed(3)} т ×</button>)}</div>
        {sandwichItems.length>0&&<div style={{marginTop:10,display:'flex',gap:7,flexWrap:'wrap'}}>{sandwichItems.map(panel=><button key={panel.id} type="button" onClick={()=>setSandwichItems(old=>old.filter(p=>p.id!==panel.id))} style={{border:'1px solid #d5e0e9',borderRadius:9,padding:'8px 10px',background:'#f1f6f3',cursor:'pointer'}}>Сэндвич-панели · {panel.quantity} шт. · {panel.lengthMm} мм · {createSandwichBundles(panel).length} пач. ×</button>)}</div>}
        <p style={{fontWeight:700}}>Всего добавлено: {(items.reduce((sum,item)=>sum+item.weight,0)+sandwichTotalWeight/1000).toFixed(3)} т / {VEHICLES[vehicleType].payload} т</p>
        {(sandwichItems.length>0||items.length>0)&&<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',margin:'12px 0'}}>
          <button type="button" onClick={()=>{
            if(animationState==='playing'){animationRef.current.state='paused';setAnimationState('paused');}
            else if(animationState==='paused'){animationRef.current.state='playing';setAnimationState('playing');}
            else {animationRestartRef.current?.();animationRef.current.state='playing';setAnimationState('playing');}
          }} style={{padding:'10px 16px',background:'#263f55',color:'#fff',border:0,borderRadius:9,cursor:'pointer'}}>{animationState==='playing'?'⏸ Пауза':animationState==='paused'?'▶ Продолжить':'▶ Проиграть погрузку'}</button>
          <button type="button" onClick={()=>{animationRef.current.state='idle';animationRestartRef.current?.();animationRef.current.state='idle';setAnimationState('idle');rebuildCargoRef.current?.();}} style={{padding:'10px 16px',border:'1px solid #cbd5e1',borderRadius:9,cursor:'pointer',background:'#fff'}}>↺ Вернуть груз в машину</button>
          <label>Скорость <select value={animationSpeed} onChange={e=>{const n=Number(e.target.value);setAnimationSpeed(n);animationRef.current.speed=n;}}><option value={0.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
        </div>}
        {sandwichItems.length>0&&<p style={{fontSize:13,color:'#51657a'}}>Сэндвич-панели: {sandwichPlan.trucks.length} шаланд · {sandwichPlan.totalPlacedBundles} размещённых пачек · {sandwichPlan.rejected.length} отклонено. 3D показывает первую шаланду.</p>}
        {items.some(isPrimaryOversized)&&<p role="alert" style={{margin:'12px 0',fontWeight:700,color:'#9a3412'}}>{OVERSIZED_NOTICE}</p>}
        <p role="status" style={{margin:'14px 0 0',fontWeight:700,color:cargoReport.includes('НЕ ПОМЕСТИЛОСЬ')?'#a53b2b':'#267052'}}>{cargoReport}</p>
      </section>
      <div className={styles.mainGrid}>
        <section className={styles.viewerCard} aria-label="Интерактивная 3D-модель автомобиля">
          <div className={styles.viewerTopBar}>
            <span className={styles.viewerLabel}><span className={styles.onlineMark} /> 3D-просмотр</span>
            <span className={styles.modelFormat}>GLB · Three.js</span>
          </div>
          <div className={styles.canvasHost} ref={hostRef}>
            {loading && !error && (
              <div className={styles.loadOverlay}>
                <span className={styles.spinner} />
                <strong>Загружаем модель МАЗа</strong>
                <span className={styles.loadDetails}>{progress > 0 ? `${progress}%` : 'Подготовка 3D-сцены…'}</span>
                <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            {error && (
              <div className={styles.errorOverlay} role="alert">
                <strong>Не удалось открыть 3D-модель</strong>
                <p>{error}</p>
              </div>
            )}
            {!loading && !error && (
              <div className={styles.canvasHint}>Нажмите на борт, чтобы открыть · Перетащите — повернуть · Колёсико — масштаб</div>
            )}
          </div>
          <div className={styles.viewerBottomBar}>
            <span>{canControl ? 'Модель загружена' : 'Ожидание модели'}</span>
            <button type="button" disabled={!canControl} onClick={() => setRotate((value) => !value)} className={`${styles.pill} ${rotate ? styles.pillActive : ''}`}>
              {rotate ? '■ Остановить вращение' : '↻ Автовращение'}
            </button>
            <button type="button" disabled={!canControl} onClick={() => viewResetRef.current?.()} className={styles.pill}>
              ⤢ Вид целиком
            </button>
          </div>
        </section>

        <aside className={styles.controls}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><h2>Боковые борта</h2><span className={styles.counter}>{availableBoards}/8</span></div>
            <p className={styles.panelDescription}>Каждая секция откидывается наружу и вниз независимо от остальных.</p>
            {(['LEFT', 'RIGHT'] as const).map((side) => {
              const count = SECTIONS.filter((number) => openBoards.has(boardId(side, number))).length;
              return (
                <div className={styles.sideBlock} key={side}>
                  <div className={styles.sideTop}>
                    <span className={styles.sideName}>{side === 'LEFT' ? 'Левый борт' : 'Правый борт'}</span>
                    <span className={styles.sideCount}>{count} из 4 открыто</span>
                  </div>
                  <div className={styles.segmentGrid}>
                    {SECTIONS.map((number) => {
                      const id = boardId(side, number);
                      const opened = openBoards.has(id);
                      return (
                        <button key={id} type="button" disabled={!canControl} aria-pressed={opened} onClick={() => toggleBoard(id)} className={`${styles.segment} ${opened ? styles.segmentActive : ''}`} title={`Секция ${Number(number)}: ${opened ? 'закрыть' : 'открыть'}`}>
                          {Number(number)} {opened ? '↘' : '▰'}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.inlineActions}>
                    <button type="button" disabled={!canControl} onClick={() => setAllBoards(side, true)}>Открыть все</button>
                    <button type="button" disabled={!canControl} onClick={() => setAllBoards(side, false)}>Закрыть все</button>
                  </div>
                </div>
              );
            })}
            <button type="button" className={`${styles.wideAction} ${rearOpen ? styles.wideActionActive : ''}`} disabled={!canControl} onClick={() => setRearOpen((value) => !value)} aria-pressed={rearOpen}>
              <span>Задний борт</span><span>{rearOpen ? 'Закрыть ↑' : 'Открыть ↓'}</span>
            </button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}><h2>Съёмные коники</h2><span className={styles.counter}>{visibleStakes}/{availableStakes}</span></div>
            <p className={styles.panelDescription}>Можно снять все стойки или выбрать конкретные, при этом гнёзда остаются на полуприцепе.</p>
            <div className={styles.twoActions}>
              <button type="button" className={styles.solidAction} disabled={!canControl} onClick={() => setAllStakes(true)}>Установить все</button>
              <button type="button" className={styles.outlineAction} disabled={!canControl} onClick={() => setAllStakes(false)}>Снять все</button>
            </div>
            <button className={styles.detailToggle} type="button" onClick={() => setShowStakeDetails((value) => !value)} aria-expanded={showStakeDetails}>
              По отдельности <span>{showStakeDetails ? '−' : '+'}</span>
            </button>
            {showStakeDetails && (
              <div className={styles.stakesGrid}>
                {(['LEFT', 'RIGHT'] as const).map((side) => (
                  <div className={styles.stakeColumn} key={side}>
                    <span className={styles.stakeColumnTitle}>{side === 'LEFT' ? 'Слева' : 'Справа'}</span>
                    {STAKE_NUMBERS.map((number) => {
                      const id = stakeId(side, number);
                      const visible = !hiddenStakes.has(id);
                      return (
                        <button className={`${styles.stakeItem} ${visible ? styles.stakeItemPresent : ''}`} disabled={!canControl} key={id} onClick={() => toggleStake(id)} aria-pressed={visible} type="button">
                          <span>{visible ? '✓' : '○'}</span> Коник {Number(number)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.infoPanel}>
            <strong>Режим проверки</strong>
            <p>Все изменения выполняются только в браузере. Исходная 3D-модель не перезаписывается, а рабочий сайт не затрагивается.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
