"""Original hand-drawn pixel assets for visual mockups, not game content."""
from pathlib import Path
from PIL import Image, ImageDraw
import math, random

ROOT = Path(__file__).parent
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
INK = '#101b25'
JADE = '#74c4aa'
PAPER = '#e7dcc4'
GOLD = '#b99c69'

def sprite(kind='hero', pose='idle'):
    im = Image.new('RGBA', (160, 208))
    d = ImageDraw.Draw(im)
    def poly(p,c): d.polygon(p,fill=c)
    def rect(p,c): d.rectangle(p,fill=c)
    # silhouette, hair and trails
    hair = '#19232b' if kind=='hero' else '#9c91a7' if kind=='mage' else '#bcb597'
    if kind=='hero':
        poly([(84,20),(100,22),(106,40),(104,63),(119,82),(116,99),(105,91),(98,71),(94,50),(82,44)],'#101923')
        poly([(95,32),(102,43),(100,66),(112,84),(107,84),(97,67)],'#29343d')
        rect((86,22,99,28),JADE)
    else:
        poly([(53,21),(86,20),(97,36),(98,73),(109,102),(93,109),(83,72),(48,78),(42,60)],hair)
    # far leg and cape
    poly([(70,120),(95,117),(101,169),(118,188),(117,194),(94,194),(83,168)],'#101b24')
    rect((97,184,123,194),'#0d1720')
    rect((100,183,116,186),'#68716b')
    poly([(63,115),(81,120),(73,177),(68,192),(46,194),(47,185),(56,175)],'#19252d')
    rect((42,187,72,197),'#0d1720')
    rect((48,185,64,188),'#777b6b')
    if kind=='hero':
        poly([(48,53),(87,51),(103,84),(102,114),(119,147),(98,157),(79,125),(63,147),(44,154),(49,115),(40,87)],'#1c514e')
        poly([(48,62),(60,54),(82,55),(91,69),(86,86),(69,96),(47,89)],PAPER)
        poly([(52,66),(69,78),(86,62),(88,74),(67,95),(55,92)],'#eee5d0')
        poly([(42,63),(51,62),(54,85),(48,107),(39,111),(34,103),(34,89)],'#d8d0ba')
        poly([(35,87),(41,87),(43,104),(37,105)],'#acb5a6')
        rect((36,106,49,114),'#265c53')
        rect((38,114,47,125),'#c99777')
        poly([(86,64),(95,65),(104,90),(103,105),(94,109),(88,100),(90,85)],'#e2d9c2')
        rect((93,101,104,109),'#386c5d')
        rect((96,110,106,118),'#d2a481')
        poly([(51,95),(87,91),(96,111),(62,121),(48,115)],'#304f49')
        poly([(53,99),(90,95),(93,104),(54,112)],'#87978a')
        rect((55,107,92,115),'#152d31')
        rect((61,108,71,114),GOLD)
        poly([(80,111),(86,111),(91,148),(85,159),(83,128)],'#be7465')
        rect((43,115,54,131),'#393733')
        rect((46,117,50,120),GOLD)
        poly([(60,121),(68,120),(57,143),(49,147)],'#638b77')
        poly([(91,123),(102,135),(110,146),(101,148)],'#5c8272')
    elif kind=='mage':
        poly([(45,55),(90,54),(107,80),(114,149),(98,164),(83,139),(55,151),(35,156),(42,106)],'#494262')
        poly([(51,60),(78,57),(94,73),(81,98),(59,96),(49,83)],'#c5b9cf')
        poly([(53,100),(82,92),(100,143),(75,151),(50,139)],'#665877')
        poly([(47,66),(37,83),(31,107),(37,119),(48,115),(55,85)],'#685a78')
        rect((34,116,42,125),'#d3a588')
        poly([(93,68),(105,73),(114,95),(109,108),(99,103),(97,86)],'#b8a5bf')
        rect((104,104,114,114),'#d8af90')
        rect((55,97,90,104),'#cfb28c')
        poly([(73,102),(78,102),(83,134),(78,144)],'#d7c4a2')
        for x,y,c in [(124,78,'#dd9563'),(127,104,'#82bfc6'),(110,58,'#e0cf85')]:
            poly([(x,y-8),(x+7,y),(x,y+8),(x-7,y)],c)
            rect((x-2,y-4,x,y-1),PAPER)
    else:
        poly([(50,58),(93,57),(108,92),(105,151),(89,161),(71,146),(43,152),(44,104)],'#38574f')
        poly([(48,62),(85,59),(101,82),(93,104),(53,106),(40,82)],'#a8b4ac')
        poly([(55,65),(78,64),(93,84),(83,94),(57,93)],'#d4d5bd')
        poly([(61,73),(83,72),(88,82),(67,88)],'#eef0d6')
        rect((52,99,96,109),'#a28a60')
        rect((67,100,77,111),PAPER)
        poly([(53,111),(90,110),(104,145),(83,157),(65,149),(47,151)],'#748d7c')
        poly([(57,120),(66,117),(66,147),(52,147)],'#c6c8ad')
        poly([(93,66),(108,77),(119,98),(111,110),(103,104),(96,87)],'#afb9a9')
        rect((108,109,118,119),'#d5b092')
        poly([(23,86),(44,73),(65,81),(73,111),(63,144),(46,156),(25,139),(16,108)],'#303f40')
        poly([(27,89),(45,81),(60,85),(64,111),(55,138),(45,146),(31,134),(24,109)],'#b49b6c')
        poly([(31,94),(45,87),(55,91),(58,110),(51,132),(44,138),(35,127),(30,109)],'#d8d8bc')
        poly([(44,93),(47,108),(55,110),(47,116),(44,131),(41,116),(34,110),(41,108)],'#8eae8b')
    # neck, face, hair cap and deliberate pixel features
    rect((62,48,79,59),'#ba876a')
    poly([(55,25),(76,22),(88,32),(86,48),(79,57),(64,54),(54,45)],'#d3a384')
    poly([(60,29),(75,27),(84,36),(81,47),(74,52),(62,46)],'#e6ba95')
    rect((53,34,57,43),'#b7856b')
    poly([(51,20),(59,15),(78,15),(87,23),(91,36),(82,33),(77,26),(71,32),(60,33),(55,40),(51,39)],hair)
    poly([(58,21),(66,19),(70,20),(64,26),(57,30)],'#40505a' if kind=='hero' else '#d5cbd0' if kind=='mage' else '#e5d9b2')
    rect((61,37,65,38),'#27343b')
    rect((77,35,81,36),'#27343b')
    rect((64,38,66,40),'#619f90' if kind=='hero' else '#665b8e')
    rect((78,36,80,38),'#619f90' if kind=='hero' else '#665b8e')
    rect((70,42,71,43),'#bd8a70')
    rect((71,48,77,49),'#995f55')
    if kind=='hero':
        rect((80,23,82,29),'#d9ddd0')
        # Thick straight lacquer shaft and visibly soft white bristle tip
        d.line([(48,177),(137,34)], fill='#0e1b23',width=9)
        d.line([(48,177),(137,34)], fill='#7e6653',width=5)
        d.line([(50,173),(137,34)], fill='#b49772',width=2)
        poly([(130,36),(137,40),(143,28),(136,24)],'#b8a073')
        poly([(135,25),(140,29),(147,22),(151,8),(145,14),(139,16)],'#dce7d5')
        poly([(140,25),(144,23),(149,12),(144,18)],'#fcf5de')
        rect((94,105,102,111),'#dda986')
    if pose=='cast':
        for i in range(8):
            x=25+i*14;y=152-int(math.sin(i/7*math.pi)*28)
            rect((x,y,x+3,y+3),JADE)
    if pose=='guard':
        d.line([(28,137),(20,98),(31,61)],fill='#83b79e',width=3)
        d.line([(16,132),(9,100),(20,68)],fill='#425f54',width=2)
    if pose=='hit':
        for x,y in [(18,49),(119,138),(128,147)]: rect((x,y,x+5,y+2),'#d9ae83')
    if pose=='attack':
        poly([(6,144),(23,136),(61,119),(92,95),(113,60),(108,87),(95,110),(71,130),(37,146)],'#d8e7ce')
        poly([(9,146),(42,135),(75,116),(103,88),(100,104),(77,128),(42,144)],'#3e8475')
    return im

def enemy(kind):
    im=Image.new('RGBA',(160,180));d=ImageDraw.Draw(im)
    if kind=='sentinel':
        d.polygon([(58,24),(90,24),(105,41),(110,62),(105,94),(112,136),(101,162),(53,165),(41,147),(47,96),(41,61),(46,36)],fill='#193f41')
        for p in [[(58,30),(75,23),(92,31),(100,54),(79,61),(51,51)],[(50,65),(79,61),(108,73),(100,99),(77,110),(48,96)],[(53,108),(81,103),(106,116),(103,139),(75,142),(47,135)]]:d.polygon(p,fill='#456e66')
        d.polygon([(58,35),(72,31),(80,43),(70,51),(54,46)],fill='#719987')
        d.rectangle((63,45,89,50),fill='#112c35');d.rectangle((65,45,73,47),fill='#a9d7b6');d.rectangle((81,45,88,47),fill='#a9d7b6')
        d.polygon([(63,76),(78,70),(91,78),(84,96),(72,102),(66,88)],fill='#71b49b')
        d.polygon([(33,63),(49,66),(47,116),(33,123),(24,112),(21,80)],fill='#315c56')
        d.polygon([(108,60),(128,73),(132,107),(119,123),(105,112)],fill='#315c56')
        d.polygon([(57,142),(72,145),(71,171),(42,174),(39,166)],fill='#214847')
        d.polygon([(88,141),(103,140),(116,167),(119,174),(87,174)],fill='#214847')
    else:
        d.polygon([(17,91),(48,66),(84,61),(112,77),(139,109),(130,123),(116,119),(103,94),(91,102),(73,107),(44,103),(26,109)],fill='#384449')
        d.polygon([(25,88),(49,69),(82,67),(75,92),(42,97)],fill='#687566')
        d.polygon([(99,61),(120,70),(137,84),(131,107),(110,105),(96,89)],fill='#5a7165')
        d.polygon([(101,68),(103,46),(111,63),(121,64),(134,46),(132,76)],fill='#577466')
        d.rectangle((112,79,119,82),fill='#b0dec0');d.rectangle((126,79,131,82),fill='#b0dec0')
        d.polygon([(127,95),(146,94),(137,107),(125,108)],fill='#1c3036')
        for x in [35,59,87,111]:d.polygon([(x,96),(x+11,96),(x+6,132),(x+14,144),(x-5,144)],fill='#3b4d48')
        d.polygon([(20,88),(6,58),(9,39),(15,61),(29,73)],fill='#547569')
    return im

def landscape(kind):
    W,H=800,450;im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im);r=random.Random(331 if kind=='main' else 912)
    for y in range(H):
        t=y/H
        c=(int(14+10*t),int(30+19*t),int(40+14*t))
        d.line((0,y,W,y),fill=c)
    d.ellipse((454,40,502,88),fill='#a4bca3')
    d.ellipse((442,39,488,83),fill='#152b36')
    for _ in range(90):
        x=r.randrange(W);y=r.randrange(12,185);s=r.choice([1,1,2]);d.rectangle((x,y,x+s,y+s),fill=r.choice(['#586963','#809286','#b5af81']))
    for layer,col,base in [(0,'#243e47',205),(1,'#274c4a',244),(2,'#31564e',275)]:
        points=[(0,340)]
        for x in range(-10,825,12):
            yy=base-int(42*math.sin(x/95+layer*2))-int(18*math.sin(x/34+layer))
            points.append((x,yy))
        points.extend([(800,380)])
        d.polygon(points,fill=col)
    # ancient gate and stepped architecture
    d.rectangle((476,167,491,299),fill='#526c61');d.rectangle((577,167,592,299),fill='#405b53')
    d.rectangle((484,174,486,280),fill='#7a8d79');d.rectangle((472,157,596,170),fill='#233f40')
    d.polygon([(459,156),(486,138),(583,138),(611,156),(604,161),(466,161)],fill='#354e49')
    d.line((487,145,584,145),fill='#738a73',width=2)
    # pale portal, pixel-only nested rings
    for n,col in [(0,'#183d41'),(8,'#24524e'),(16,'#3a7263'),(23,'#70a185'),(26,'#173b41')]:
        d.ellipse((500+n//2,179+n//3,568-n//2,295-n//3),fill=col)
    for _ in range(85):
        x=r.randrange(492,584);y=r.randrange(175,298)
        if r.random()<.4:d.rectangle((x,y,x+1,y+2),fill='#789d7c')
    # distant pavilion
    for y,w in [(160,100),(190,125),(220,150)]:
        cx=695
        d.rectangle((cx-w//2+12,y,cx+w//2-12,y+30),fill='#20383b')
        d.polygon([(cx-w//2-10,y),(cx-w//2+13,y-9),(cx,y-16),(cx+w//2-13,y-9),(cx+w//2+10,y),(cx+w//2,y+5),(cx-w//2,y+5)],fill='#132b34')
        d.line((cx-w//2+6,y+3,cx+w//2-6,y+3),fill='#607566',width=2)
    # ground, tiled stone foreground and small plants
    d.polygon([(0,313),(330,303),(536,307),(800,301),(800,450),(0,450)],fill='#1c3538')
    for y in range(330,451,20):
        d.line((0,y,800,y-6),fill='#42584e',width=1)
        for x in range(-20,821,65):
            xx=x+(30 if (y//20)%2 else 0)
            d.line((xx,y-17,xx+8,y),fill='#344f46')
            if r.random()<.32:d.line((xx+12,y-4,xx+36,y-4),fill='#536756')
    if kind=='lobby':
        # a sheltered courtyard, lanterns and warm hearth
        d.rectangle((0,22,800,36),fill='#182b31')
        for x in [54,740]:
            d.rectangle((x,26,x+17,333),fill='#344b45');d.rectangle((x+4,34,x+6,320),fill='#657362')
            d.rectangle((x-12,93,x+29,131),fill='#65573c')
            d.rectangle((x-7,96,x+24,128),fill='#b89157')
            d.rectangle((x+3,95,x+13,130),fill='#e8c88a')
            d.line((x+8,37,x+8,93),fill='#7e8060')
        for x in [200,350,500,650]:
            d.rectangle((x,54,x+4,86),fill='#464e40');d.rectangle((x-7,83,x+11,111),fill='#c49e62');d.rectangle((x-3,87,x+7,107),fill='#e0bb7d')
        d.polygon([(275,337),(347,327),(418,337),(390,364),(294,365)],fill='#263932')
        for x in range(304,391,13):d.line((x,345,x+9,353),fill='#7b6d47',width=3)
        for j in range(18):
            x=r.randrange(325,366);y=r.randrange(294,350)
            d.polygon([(x,y+24),(x-6,y+12),(x,y-5),(x+5,y+8),(x+9,y+24)],fill=r.choice(['#b89a60','#d6b377','#8c754e']))
    # silhouettes of near leaves and reeds
    for side in [0,1]:
        xx=6 if side==0 else 788
        d.line((xx,450,xx+(-18 if side else 15),139),fill='#0c2029',width=16)
        for j in range(13):
            y=170+j*19
            x=xx+(-30 if side else 23)
            d.line((xx,y,x+(-25 if side else 33),y-25),fill='#10262e',width=8)
            for _ in range(8):
                lx=x+r.randrange(-24,25);ly=y+r.randrange(-24,6)
                d.rectangle((lx,ly,lx+r.randrange(5,13),ly+r.randrange(3,8)),fill=r.choice(['#142f34','#23433f','#2b4b43']))
    for _ in range(100):
        x=r.randrange(W);y=r.randrange(290,450)
        if r.random()<.6:d.line((x,y,x-3,y-r.randrange(3,12)),fill=r.choice(['#244c43','#44664e','#59765a']))
    for _ in range(22):
        x=r.randrange(70,770);y=r.randrange(130,420)
        d.rectangle((x,y,x+2,y+2),fill='#b4ab78')
    return im

def card_art(kind):
    im=Image.new('RGB',(180,150),'#14272f');d=ImageDraw.Draw(im);r=random.Random(22)
    for y in range(150):d.line((0,y,180,y),fill=(22+int(y*.04),41+int(y*.04),47+int(y*.025)))
    for _ in range(70):
        x=r.randrange(180);y=r.randrange(150);d.rectangle((x,y,x+1,y+1),fill='#3b514e')
    if kind=='ink':
        d.ellipse((23,14,157,145),outline='#688b77',width=2)
        d.polygon([(11,124),(43,118),(98,91),(144,47),(164,12),(160,44),(135,84),(96,113),(49,134)],fill='#c8dcc0')
        d.polygon([(14,128),(62,115),(113,88),(149,49),(141,82),(111,112),(67,134),(37,139)],fill='#63a78d')
        d.polygon([(22,128),(67,116),(111,90),(145,51),(122,88),(87,115),(42,135)],fill='#142f36')
        d.line((34,142,127,15),fill='#c5af89',width=5)
        d.polygon([(124,19),(135,3),(138,15),(130,31)],fill=PAPER)
    elif kind=='fire':
        d.ellipse((38,23,149,129),outline='#778593',width=3)
        d.polygon([(42,121),(52,74),(73,87),(93,17),(108,65),(128,42),(143,91),(131,129)],fill='#b66350')
        d.polygon([(61,119),(83,84),(85,56),(101,90),(114,70),(127,112),(107,136)],fill='#e0a16d')
        d.polygon([(87,125),(97,92),(111,116),(107,134)],fill='#ead7a0')
        d.line([(19,50),(64,73),(48,86),(94,94),(70,112),(157,123)],fill='#92c4ce',width=4)
    elif kind=='shield':
        d.ellipse((35,16,146,139),outline='#a2a280',width=2)
        d.polygon([(45,43),(90,20),(135,43),(128,98),(90,135),(52,99)],fill='#b6a171')
        d.polygon([(52,48),(90,29),(128,48),(121,94),(90,124),(59,95)],fill='#d2d7bc')
        d.polygon([(61,52),(90,36),(119,52),(112,89),(90,111),(68,90)],fill='#507966')
        d.polygon([(90,44),(96,72),(112,79),(96,87),(90,106),(85,88),(69,79),(85,72)],fill='#e9e1ba')
        for x in [23,151]:d.line((x,50,x,111),fill='#bdb685',width=2)
    else:
        for box,c in [((35,14,150,142),'#656583'),((46,25,139,130),'#9cabc0'),((54,33,131,123),'#152e3b')]:d.ellipse(box,fill=c)
        d.polygon([(83,32),(105,44),(85,63),(107,80),(77,103),(98,126),(72,105),(91,81),(69,61),(92,44)],fill='#dbe4c9')
        d.line((35,133,146,20),fill='#85c3ad',width=4)
        for _ in range(22):
            x=r.randrange(28,152);y=r.randrange(20,136);d.rectangle((x,y,x+2,y+2),fill=r.choice(['#c6b785','#8aaac0','#d7ddc5']))
    return im

def slash_frame(t):
    im=Image.new('RGBA',(800,450));d=ImageDraw.Draw(im);r=random.Random(97)
    if t<.22:
        for n in range(10):
            a=n*math.tau/10+t*5;x=232+int(math.cos(a)*22);y=274+int(math.sin(a)*30)
            d.rectangle((x,y,x+3,y+3),fill=(125,197,165,220))
    elif t<.78:
        a=(t-.22)/.56
        end=300+int(a*330)
        trail=[(240,292),(320,257),(405,225),(505,195),(615,165),(591,186),(480,225),(391,258),(318,285),(258,309)]
        d.polygon(trail,fill=(139,202,168,230))
        d.polygon([(251,293),(334,263),(416,237),(503,211),(594,181),(480,231),(392,262),(319,288)],fill=(235,235,201,255))
        d.polygon([(260,295),(332,270),(416,240),(505,208),(587,184),(489,225),(405,256),(316,287)],fill=(21,53,58,255))
        d.line([(255,299),(337,275),(425,244),(522,208)],fill=(116,200,165,255),width=3)
        if a>.48:
            cx,cy=616,212
            for n in range(26):
                an=r.random()*math.tau;rr=r.randrange(9,65);x=cx+int(math.cos(an)*rr);y=cy+int(math.sin(an)*rr)
                sz=r.choice([2,3,4]);d.rectangle((x,y,x+sz,y+sz),fill=r.choice(['#dfe9c9','#82c6a1','#c1b68a']))
            d.polygon([(cx-5,cy-37),(cx+2,cy-8),(cx+30,cy),(cx+5,cy+4),(cx,cy+32),(cx-6,cy+6),(cx-24,cy),(cx-6,cy-5)],fill='#e9edcc')
    else:
        fade=int(210*(1-t)/.22)
        for n in range(18):
            x=340+n*16;y=278-int(n*4)+int((t-.8)*40)
            d.rectangle((x,y,x+3,y+3),fill=(130,194,163,max(0,fade)))
    return im

for kind in ['hero','mage','paladin']:
    for pose in ['idle','attack','cast','guard','hit']:
        sprite(kind,pose).save(OUT/f'{kind}-{pose}.png')
    face=sprite(kind).crop((42,10,100,69))
    face.save(OUT/f'{kind}-portrait.png')
for kind in ['sentinel','wolf']:enemy(kind).save(OUT/f'{kind}.png')
for kind in ['main','lobby','battle']:
    landscape(kind).resize((1600,900),Image.Resampling.NEAREST).save(OUT/f'{kind}-background.png')
for kind in ['ink','fire','shield','fusion']:card_art(kind).save(OUT/f'card-{kind}.png')
for n,t in enumerate([0,.15,.32,.48,.62,.76,.9]):slash_frame(t).save(OUT/f'slash-{n}.png')

# A standalone actual animation, all visual state is independent of game rules.
bg=landscape('battle').convert('RGBA')
frames=[]
for n in range(24):
    t=n/23
    fr=bg.copy()
    h=sprite('hero','cast' if t<.23 else 'attack' if t<.8 else 'idle').resize((160,208),Image.Resampling.NEAREST)
    fr.alpha_composite(h,(140,136))
    fr.alpha_composite(enemy('sentinel'),(553,150))
    fr.alpha_composite(slash_frame(t))
    frames.append(fr.convert('RGB').resize((1280,720),Image.Resampling.NEAREST))
frames[0].save(OUT/'ink-slash.gif',save_all=True,append_images=frames[1:],duration=[70]*23+[850],loop=0,disposal=2)
print(f'Created {len(list(OUT.iterdir()))} original pixel assets in {OUT}')
