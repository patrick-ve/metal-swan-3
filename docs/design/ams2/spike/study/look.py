import json, numpy as np
from PIL import Image
SPR='../sprites/'
def hexrgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def frame(name, strip, i):
    d=json.load(open(SPR+name+'.json')); f=d['strips'][strip][i]
    pal=[hexrgb(c) for c in d['pal']]
    idx=np.array(f['idx']).reshape(f['h'],f['w'])
    a=np.zeros((f['h'],f['w'],4),np.uint8)
    for j in np.unique(idx):
        if j: a[idx==j,:3]=pal[j]; a[idx==j,3]=255
    return a,f['ox'],f['oy']
def hero(name='vincent',legs='legs-idle',tor='torso-pistol-idle',li=0,ti=0):
    d=json.load(open(SPR+name+'.a.json')) if False else None
    l,lx,ly=frame(name,legs,li); t,tx,ty=frame(name,tor,ti)
    C=np.zeros((80,80,4),np.uint8)
    def put(a,x,y):
        h,w=a.shape[:2]; k=a[...,3]>0; C[y:y+h,x:x+w][k]=a[k]
    # hip -18 for idle
    put(l,40-lx,70-ly); put(t,40-tx,70-18-ty)
    ys,xs=np.nonzero(C[...,3]); return C[ys.min():ys.max()+1,xs.min():xs.max()+1]
if __name__=='__main__':
    items=[('vincent idle',hero()),('thom',hero('thom')),('handhaver',frame('handhaver','idle',0)[0]),('rider',frame('delivery-rider','ride',0)[0]),('vendor',frame('ams-hotdog-vendor','idle',0)[0]),('gull',frame('seagull','idle',0)[0])]
    Z=8; W=sum(i[1].shape[1]*Z+16 for i in items); H=max(i[1].shape[0]*Z for i in items)+16
    S=Image.new('RGB',(W,H),(70,120,170)); x=8
    for n,a in items:
        im=Image.fromarray(a,'RGBA').resize((a.shape[1]*Z,a.shape[0]*Z),0); S.paste(im,(x,8),im); x+=a.shape[1]*Z+16
    S.save('heroes8x.png'); print(S.size)
