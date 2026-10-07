// Private defaults: imported only by the protected server endpoint.
import catalogue from './growth-catalogue.json';
import sourceObservations from './growth-source.json';
import type { GrowthState, Catalogue } from './growth';
export function initialGrowthState():GrowthState {return {
 sourceObservations,settings:{start:'2026-10-03',method:'Lower grade',lifeShare:null,baseAttempts:null,exerciseLinks:{}},
 supports:[
  {player:'Abinesh',order:1,responsibilities:'Single; mother to care for',earns:'Not recorded',extraDays:null,extraAttempts:null,approved:false,basis:''},
  {player:'Stephen',order:2,responsibilities:'Single; mother and sister; branding work',earns:'Not recorded',extraDays:null,extraAttempts:null,approved:false,basis:''},
  {player:'Surjith',order:3,responsibilities:'Married',earns:'Not recorded',extraDays:null,extraAttempts:null,approved:false,basis:''},
  {player:'Premothan',order:4,responsibilities:'Married with child',earns:'Not recorded',extraDays:null,extraAttempts:null,approved:false,basis:''},
 ],days:[],reviews:[],reviewHistory:[],practices:[],tasks:[],catalogue:catalogue as Catalogue[],incidents:[
  {id:'source-2026-10-03',date:'2026-10-03',catalogueId:'M001',observation:'Not using AI for the right job: routine document creation',minutes:240,reportedCount:3,affected:[],timeType:'Avoidable',kind:'Mistake',attribute:'C2D',supporting:['C2A','C1A'],status:'Pending',evidence:'DAY_Gamer_Tracker_v2.xlsx · Day1 Original Skill Log',explanation:'Confirm affected players and review whether AI was suitable.',recovery:'Recover the delayed output using a reviewed method.',exerciseUrl:'',sourceNote:'Source reports 4 hours per gamer × 3 = 12 person-hours. Earlier discussion described 3 hours / 50% manual work. Confirm the discrepancy; no personal allocation or grades assumed.'},
  {id:'source-2026-10-05',date:'2026-10-05',catalogueId:'M002',observation:'Too much time on document creation',minutes:120,reportedCount:4,affected:[],timeType:'Avoidable',kind:'Mistake',attribute:'C2D',supporting:[],status:'Pending',evidence:'DAY_Gamer_Tracker_v2.xlsx · Day1 Original Skill Log',explanation:'Confirm date and affected players before allocating hours.',recovery:'Recover the delayed output using a reviewed method.',exerciseUrl:'',sourceNote:'Source skill log dates this event 5 October, while the second daily row is 4 October. 2 hours × 4 = 8 reported person-hours. Allocation remains pending.'},
 ]};}
