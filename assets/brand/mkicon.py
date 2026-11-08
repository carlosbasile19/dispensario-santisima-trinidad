import numpy as np, sys, os, subprocess
os.chdir(sys.argv[1])
W,H=382,516
m=np.fromfile('mark_raw.rgba',dtype=np.uint8).reshape(H,W,4)[...,3].astype(float)/255
S=1024
def canvas(radius, scale=0.80):
    # place mark centred on a 1024 canvas at `scale` of height
    h=int(S*scale); w=int(W*h/H)
    # nearest-neighbour upscale via index maps (good enough before dilation + smooth downscale)
    yi=(np.arange(h)*H/h).astype(int); xi=(np.arange(w)*W/w).astype(int)
    up=m[yi][:,xi]
    a=np.zeros((S,S)); y0=(S-h)//2; x0=(S-w)//2; a[y0:y0+h,x0:x0+w]=up
    if radius:
        out=a.copy(); r=radius
        for dy in range(-r,r+1):
            for dx in range(-r,r+1):
                if dx*dx+dy*dy<=r*r:
                    out=np.maximum(out,np.roll(np.roll(a,dy,0),dx,1))
        a=out
    return a
def write(a,name,rounded=True):
    yy,xx=np.mgrid[0:S,0:S]; R=int(S*0.22)
    tile=np.ones((S,S))
    if rounded:
        cx=np.clip(xx,R,S-1-R); cy=np.clip(yy,R,S-1-R)
        tile=((xx-cx)**2+(yy-cy)**2<=R*R).astype(float)
    bg=np.array([0xfa,0xf8,0xf4],float); fg=np.array([0x1b,0x2a,0x55],float)
    rgb=bg*(1-a[...,None])+fg*a[...,None]
    img=np.dstack([rgb,tile*255]).astype(np.uint8)
    img.tofile(name+'.rgba')
for name,r,sc in [('big',5,0.80),('mid',16,0.84),('small',26,0.88)]:
    write(canvas(r,sc),'icon_'+name)
write(canvas(5,0.80),'apple_sq',rounded=False)
