"""Measure a sprite or a scene the same way: what makes the hero look like the hero."""
import numpy as np, colorsys, sys, json
from PIL import Image
from collections import defaultdict
def lum(c): r,g,b=[(v/255)**2.2 for v in c]; return (.2126*r+.7152*g+.0722*b)**(1/2.2)
def metrics(a, name=''):
    """a: RGBA uint8. Opaque pixels only."""
    h,w=a.shape[:2]; op=a[...,3]>0; n=int(op.sum())
    key=(a[...,0].astype(int)<<16)|(a[...,1].astype(int)<<8)|a[...,2].astype(int)
    key=np.where(op,key,-1)
    cols,cnt=np.unique(key[op],return_counts=True)
    # connected clusters of one colour (4-neighbour)
    lab=np.zeros((h,w),int); nl=0; sizes=[]
    for y in range(h):
        for x in range(w):
            if not op[y,x] or lab[y,x]: continue
            nl+=1; st=[(y,x)]; lab[y,x]=nl; s=0; k=key[y,x]
            while st:
                j,i=st.pop(); s+=1
                for d,e in ((1,0),(-1,0),(0,1),(0,-1)):
                    Y,X=j+d,i+e
                    if 0<=Y<h and 0<=X<w and not lab[Y,X] and key[Y,X]==k: lab[Y,X]=nl; st.append((Y,X))
            sizes.append(s)
    sizes=np.array(sizes)
    # edges: pairs of neighbours that differ, and how hard
    L=np.vectorize(lambda v: lum(((v>>16)&255,(v>>8)&255,v&255)) if v>=0 else -1,otypes=[float])(key)
    dx=(key[:,1:]!=key[:,:-1])&op[:,1:]&op[:,:-1]; dy=(key[1:,:]!=key[:-1,:])&op[1:,:]&op[:-1,:]
    pairs=dx.sum()+dy.sum(); total=(op[:,1:]&op[:,:-1]).sum()+(op[1:,:]&op[:-1,:]).sum()
    dl=np.concatenate([np.abs(L[:,1:]-L[:,:-1])[dx],np.abs(L[1:,:]-L[:-1,:])[dy]]) if pairs else np.zeros(1)
    # checker dither: pixels whose 4 neighbours alternate a pair
    dark=(L>=0)&(L<.22)
    hsv=np.array([colorsys.rgb_to_hsv((v>>16&255)/255,(v>>8&255)/255,(v&255)/255) for v in cols])
    lv=np.array([lum(((v>>16)&255,(v>>8)&255,v&255)) for v in cols])
    wsat=(hsv[:,1]*cnt).sum()/cnt.sum()
    return dict(name=name,px=n,colours=len(cols),colours_per_1000=round(len(cols)/n*1000,1),
      cluster_mean=round(float(sizes.mean()),1),cluster_median=float(np.median(sizes)),lone_pct=round(float((sizes==1).sum())/n*100,1),
      edge_pct=round(float(pairs)/total*100,1),edge_contrast=round(float(dl.mean()),3),hard_edge_pct=round(float((dl>.2).sum())/total*100,1),
      soft_edge_pct=round(float((dl<.04).sum())/total*100,1),
      dark_pct=round(float(dark[op].sum())/n*100,1),L_min=round(float(lv.min()),2),L_max=round(float(lv.max()),2),L_std=round(float(L[op].std()),3),sat=round(float(wsat),2))
if __name__=='__main__':
    pass
