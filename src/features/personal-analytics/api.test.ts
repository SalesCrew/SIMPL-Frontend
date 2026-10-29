import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({ id:"e68b62cd-06b3-4300-8a16-dc04e20ed75d",present:true }));
vi.mock("../../data",()=>({supabase:{auth:{getSession:async()=>({data:{session:session.present?{user:{id:session.id},access_token:"test-owner-token"}:null}})}}}));
import { fetchPersonalAnalytics } from "./api";
const payload={meta:{snapshot_at:"2026-10-29T12:00:00Z",snapshot_vienna:"2026-10-29 13:00",first_date:"2026-05-20",last_date:"2026-10-29",workspace:"Development"},flow_meta:{open_cards:0},coverage:{start_date:"2026-05-20",source:"earliest_available_date",confirmed_complete:false},tasks:[],flow_tasks:[]};
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{session.id="e68b62cd-06b3-4300-8a16-dc04e20ed75d";session.present=true;fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(payload),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",fetcher)});
afterEach(()=>vi.unstubAllGlobals());
describe("private analytics fetch contract",()=>{
 it("sends the existing session only to the private authenticated endpoint, never a selectable actor/workspace",async()=>{const signal=new AbortController().signal;expect(await fetchPersonalAnalytics(signal)).toEqual(payload);expect(fetcher).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/\/api\/personal-analytics$/),{method:"GET",headers:{Authorization:"Bearer test-owner-token",Accept:"application/json"},cache:"no-store",signal});});
 it("does not request data for missing sessions or a different authenticated account",async()=>{session.present=false;await expect(fetchPersonalAnalytics(new AbortController().signal)).rejects.toMatchObject({status:401});session.present=true;session.id="another-administrator";await expect(fetchPersonalAnalytics(new AbortController().signal)).rejects.toMatchObject({status:404});expect(fetcher).not.toHaveBeenCalled();});
 it.each([401,403,404,500])("treats %s as a failed protected read without leaking server bodies",async status=>{fetcher.mockResolvedValue(new Response('{"secret":"must not be shown"}',{status}));await expect(fetchPersonalAnalytics(new AbortController().signal)).rejects.toMatchObject({status});await expect(fetchPersonalAnalytics(new AbortController().signal)).rejects.not.toThrow(/secret/);});
 it("rejects an invalid successful response rather than rendering a partial report",async()=>{fetcher.mockResolvedValue(new Response('{}',{status:200}));await expect(fetchPersonalAnalytics(new AbortController().signal)).rejects.toMatchObject({status:502});});
});
