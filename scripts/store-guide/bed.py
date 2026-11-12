"""Quiet original music bed for the store guide (piano arpeggios, synthesized here)."""
import sys, wave, numpy as np
from scipy.signal import fftconvolve
SR=44100; DUR=float(sys.argv[2]); rng=np.random.default_rng(3)
L=np.zeros(int(DUR*SR)+SR)
def hz(n): return 440*2**((n-69)/12)
def piano(n,d=2.4,v=.4):
    t=np.arange(int(d*SR))/SR; f=hz(n)
    o=sum(np.sin(2*np.pi*f*k*t)*.6**(k-1)*np.exp(-t*(1.4+.8*k)) for k in range(1,6))
    return v*.2*o*np.minimum(1,t/.005)
prog=[[48,55,60,64,67],[45,52,57,60,64],[41,48,53,57,60],[43,50,55,59,62]]
t=0.0; i=0; beat=60/76
while t<DUR:
    ch=prog[(i//1)%4]
    for j,n in enumerate([ch[0],ch[2],ch[3],ch[4],ch[3],ch[2],ch[3],ch[1]]):
        at=int((t+j*beat/2)*SR)
        if at>=len(L): continue
        s=piano(n+12 if j else n,2.6,.35 if j else .45); e=min(len(L),at+len(s)); L[at:e]+=s[:e-at]
    t+=4*beat; i+=1
L=L[:int(DUR*SR)]
ir=rng.standard_normal(int(2*SR))*np.exp(-np.arange(int(2*SR))/SR*2.5); ir/=np.sqrt((ir**2).sum())
x=L+.35*fftconvolve(L,ir)[:len(L)]
f=np.ones_like(x); n=int(3*SR); f[-n:]=np.linspace(1,0,n); f[:SR]=np.linspace(0,1,SR); x*=f
x=x/np.max(np.abs(x))*.5
pcm=(np.stack([x,x],1)*32767).astype('<i2')
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
