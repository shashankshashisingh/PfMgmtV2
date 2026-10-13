// Run: node tests/core.test.js
// Core maths is copied from index.html between the CORE markers.

const TD=252;
const sum=a=>{let s=0;for(const x of a)s+=x;return s};
const mean=a=>a.length?sum(a)/a.length:NaN;
function std(a){if(a.length<2)return NaN;const m=mean(a);let s=0;for(const x of a)s+=(x-m)*(x-m);return Math.sqrt(s/(a.length-1))}
function cov(a,b){const ma=mean(a),mb=mean(b);let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-ma)*(b[i]-mb);return s/(a.length-1)}
function maxDrawdown(idx){let peak=-Infinity,mdd=0;const dd=[];for(const v of idx){if(v>peak)peak=v;const d=v/peak-1;dd.push(d);if(d<mdd)mdd=d}return {mdd,dd}}
function rebase(r){const out=[100];for(const x of r)out.push(out[out.length-1]*(1+x));return out}
function pctile(a,p){if(!a.length)return NaN;const s=a.slice().sort((x,y)=>x-y);const k=(s.length-1)*p;const f=Math.floor(k),c=Math.ceil(k);return s[f]+(s[c]-s[f])*(k-f)}
function xirr(flows){
  if(flows.length<2)return NaN;
  const t0=flows[0].t,Y=31557600000;
  const f=r=>{let s=0;for(const c of flows)s+=c.amt/Math.pow(1+r,(c.t-t0)/Y);return s};
  let lo=-0.99,hi=20,flo=f(lo),fhi=f(hi);
  if(!(flo*fhi<0))return NaN;
  for(let i=0;i<200;i++){const mid=(lo+hi)/2,fm=f(mid);if(flo*fm<=0){hi=mid;fhi=fm}else{lo=mid;flo=fm}}
  return (lo+hi)/2;
}
function sortTxns(txns){return txns.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0)}
function processTxns(txns){
  const book={};
  for(const t of sortTxns(txns)){
    const b=book[t.symbol]||(book[t.symbol]={lots:[],realised:0});
    if(t.type==='BUY'){b.lots.push({date:t.date,qty:t.qty,price:t.price})}
    else{let q=t.qty;while(q>1e-9&&b.lots.length){const l=b.lots[0];const take=Math.min(l.qty,q);b.realised+=take*(t.price-l.price);l.qty-=take;q-=take;if(l.qty<=1e-9)b.lots.shift()}}
  }
  return book;
}
function portfolioSeries(txns,dates,px){
  const sorted=sortTxns(txns),n=dates.length;
  const qty={},value=new Array(n).fill(0),flow=new Array(n).fill(0),invested=new Array(n).fill(0);
  let ti=0,cum=0;
  for(let i=0;i<n;i++){
    while(ti<sorted.length&&sorted[ti].date<=dates[i]){const t=sorted[ti],s=t.type==='BUY'?1:-1;qty[t.symbol]=(qty[t.symbol]||0)+s*t.qty;flow[i]+=s*t.qty*t.price;ti++}
    cum+=flow[i];invested[i]=cum;
    let v=0;for(const s in qty){const p=px[s];if(p&&p[i]!=null)v+=qty[s]*p[i]}
    value[i]=v;
  }
  let start=-1;for(let i=0;i<n;i++){if(value[i]>0){start=i;break}}
  const ret=new Array(n).fill(null),idx=new Array(n).fill(null);
  if(start>=0){
    idx[start]=100;
    for(let i=start+1;i<n;i++){
      if(value[i-1]>0){ret[i]=(value[i]-flow[i])/value[i-1]-1;idx[i]=idx[i-1]*(1+ret[i])}
      else idx[i]=idx[i-1];
    }
  }
  return {value,flow,invested,ret,idx,start};
}
function perfStats(pr,rf){
  const n=pr.length,o={n};
  if(n<2)return o;
  const mp=mean(pr)*TD,vp=std(pr)*Math.sqrt(TD);
  o.vol=vp;o.annMean=mp;
  const cum=pr.reduce((a,x)=>a*(1+x),1);
  o.total=cum-1;o.cagr=n>=60?Math.pow(cum,TD/n)-1:NaN;
  o.sharpe=n>=20?(mp-rf)/vp:NaN;
  const dr=rf/TD;let dd=0;for(const x of pr){const d=Math.min(0,x-dr);dd+=d*d}
  const dsd=Math.sqrt(dd/n)*Math.sqrt(TD);
  o.sortino=n>=20&&dsd>0?(mp-rf)/dsd:NaN;
  o.mdd=maxDrawdown(rebase(pr)).mdd;
  return o;
}
function relStats(pr,br,rf){
  const n=pr.length,o={};
  if(n<20)return o;
  const mp=mean(pr)*TD,mb=mean(br)*TD;
  const vb=cov(br,br),vpp=cov(pr,pr),c=cov(pr,br);
  o.beta=c/vb;
  o.alpha=(mp-rf)-o.beta*(mb-rf);
  o.corr=c/Math.sqrt(vb*vpp);
  o.r2=o.corr*o.corr;
  const ex=pr.map((x,i)=>x-br[i]);
  o.te=std(ex)*Math.sqrt(TD);
  o.ir=o.te>0?(mean(ex)*TD)/o.te:NaN;
  const up=[],dn=[];for(let i=0;i<n;i++){if(br[i]>0)up.push(i);else if(br[i]<0)dn.push(i)}
  o.upCap=up.length?mean(up.map(i=>pr[i]))/mean(up.map(i=>br[i])):NaN;
  o.dnCap=dn.length?mean(dn.map(i=>pr[i]))/mean(dn.map(i=>br[i])):NaN;
  return o;
}
function periodStart(dates,key){
  const n=dates.length;
  const back={'1M':21,'3M':63,'6M':126,'1Y':252}[key];
  if(back)return Math.max(0,n-1-back);
  if(key==='YTD'){const y=dates[n-1].slice(0,4);let i=0;while(i<n&&dates[i].slice(0,4)<y)i++;return Math.max(0,i-1)}
  return 0;
}
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok',m)};
const x=xirr([{t:Date.parse('2025-01-01'),amt:-1000},{t:Date.parse('2026-01-01'),amt:1100}]);
assert(Math.abs(x-0.10)<0.002,'xirr');
assert(Math.abs(maxDrawdown([100,120,90,110]).mdd-(-0.25))<1e-9,'max drawdown');
const b=processTxns([{date:'2026-01-01',symbol:'A',type:'BUY',qty:10,price:100},{date:'2026-02-01',symbol:'A',type:'BUY',qty:10,price:200},{date:'2026-03-01',symbol:'A',type:'SELL',qty:15,price:300}]);
assert(b.A.realised===2500,'FIFO realised profit');
const ps=portfolioSeries([{date:'2026-01-01',symbol:'A',type:'BUY',qty:10,price:100},{date:'2026-01-02',symbol:'A',type:'BUY',qty:10,price:110}],['2026-01-01','2026-01-02','2026-01-05'],{A:[100,110,121]});
assert(Math.abs(ps.idx[2]-121)<1e-6,'time-weighted return ignores deposits');
