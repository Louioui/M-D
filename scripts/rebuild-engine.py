"""Blender 5: rebuild visible hard surfaces while preserving the owner's engine.

Coordinates below are the original glTF's display units, not certified Toyota CAD.
The new parts are an illustrative hard-surface reconstruction from the reference.
Run with Blender --background --factory-startup --python scripts/rebuild-engine.py.
"""
import bpy, bmesh, math, json, array, os
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / 'public/models'
STEPS = 32
TAU = math.tau
def xyz(p): return (p[0], -p[2], p[1])
def gcoord(v): return Vector((v.x, v.z, -v.y))

def material(name, color, metal, rough, surface):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal; bs.inputs['Roughness'].default_value = rough
    m['mdSurface'] = surface
    return m

def mesh(name, verts, faces, mat, bevel=0):
    data = bpy.data.meshes.new(name); data.from_pydata([xyz(p) for p in verts], [], faces); data.update()
    uv = data.uv_layers.new(name='Mechanical planar UV')
    for poly in data.polygons:
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for loop in poly.loop_indices:
            p = data.vertices[data.loops[loop].vertex_index].co
            uv.data[loop].uv = (p[axes[0]],p[axes[1]])
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj); obj.data.materials.append(mat)
    obj['mdRebuilt'] = True; obj['mdSurface'] = mat['mdSurface']
    if bevel:
        mod = obj.modifiers.new('Machined edge bevel', 'BEVEL'); mod.width = bevel; mod.segments = 3; mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = obj; obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name); obj.select_set(False)
    # Angle-aware smoothing: flat faces remain flat; the bevel strips stay smooth.
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    for edge in bm.edges:
        edge.smooth = not edge.is_manifold or edge.calc_face_angle(0) < math.radians(38)
    for face in bm.faces: face.smooth = True
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    return obj

def slab(name, outline, low, high, mat, bevel=.008, slope=0):
    verts = [(x, low+slope*z, z) for x,z in outline] + [(x, high+slope*z, z) for x,z in outline]
    n=len(outline); faces=[tuple(reversed(range(n))), tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,bevel)

def box(name, center, size, mat, bevel=.005):
    x,y,z=center; a,b,c=[v/2 for v in size]
    return slab(name,[(x-a,z-c),(x+a,z-c),(x+a,z+c),(x-a,z+c)],y-b,y+b,mat,bevel)

def ring(name, center, radius, inner, depth, mat, axis='x', count=96, bevel=.001):
    x,y,z=center; vs=[]
    for d,r in [(-depth/2,radius),(depth/2,radius),(depth/2,inner),(-depth/2,inner)]:
        for i in range(count):
            a=i/count*TAU
            if axis=='x':vs.append((x+d,y+math.cos(a)*r,z+math.sin(a)*r))
            elif axis=='y':vs.append((x+math.cos(a)*r,y+d,z+math.sin(a)*r))
            else:vs.append((x+math.cos(a)*r,y+math.sin(a)*r,z+d))
    fs=[]
    for layer in range(4):
        for i in range(count): fs.append((layer*count+i,layer*count+(i+1)%count,((layer+1)%4)*count+(i+1)%count,((layer+1)%4)*count+i))
    return mesh(name,vs,fs,mat,bevel)

def tube(name, points, radius, mat, sides=16, oval=1, corrugation=0, capped=True):
    # Smooth Catmull-Rom path sampled into a real swept tube, not a painted hose.
    path=[]
    for k in range(len(points)-1):
        a,b,c,d=[Vector(points[max(0,min(len(points)-1,i))]) for i in [k-1,k,k+1,k+2]]
        for step in range(12):
            t=step/12
            path.append((2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)*.5)
    path.append(Vector(points[-1])); verts=[]
    for i,p in enumerate(path):
        direction=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
        n=direction.cross(Vector((1,0,0)))
        if n.length<.01: n=direction.cross(Vector((0,1,0)))
        n.normalize(); cross=direction.cross(n).normalized()
        r=radius*(1+corrugation*math.cos(i*math.pi))
        for j in range(sides):
            angle=j/sides*TAU
            verts.append(p+n*(math.cos(angle)*r)+cross*(math.sin(angle)*r*oval))
    faces=[]
    for i in range(len(path)-1):
        for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    if capped: faces.extend([tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))])
    return mesh(name,verts,faces,mat)

def bolt(name, position, mat, washer_mat, axis='x', radius=.017):
    x,y,z=position; n=6; verts=[]
    # Closed hex head with an actual recessed six-sided socket and a socket floor.
    for offset,r in [(0,radius*.86),(.002,radius),(.014,radius),(.016,radius*.86),(.016,radius*.43),(.007,radius*.43)]:
        for j in range(n):
            a=j/n*TAU
            if axis=='x':verts.append((x+offset,y+math.cos(a)*r,z+math.sin(a)*r))
            elif axis=='y':verts.append((x+math.cos(a)*r,y+offset,z+math.sin(a)*r))
            else:verts.append((x+math.cos(a)*r,y+math.sin(a)*r,z+offset))
    faces=[tuple(reversed(range(n))),tuple(range(5*n,6*n))]
    faces += [(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(5) for j in range(n)]
    obj=mesh(name,verts,faces,mat,.0007)
    seat=(x-.002,y,z) if axis=='x' else (x,y-.002,z) if axis=='y' else (x,y,z-.002)
    ring(name+' washer',seat,radius*1.32,radius*.5,.003,washer_mat,axis,32,.0005)
    return obj

def build_parts():
    polymer=material('MD | molded graphite polymer',(.012,.018,.026),.015,.68,3)
    rubber=material('MD | gasket and ribbed conduit',(.009,.012,.015),0,.85,6)
    alloy=material('MD | satin cast alloy',(.48,.51,.54),.86,.48,1)
    steel=material('MD | precision satin flexplate steel',(.33,.36,.40),.94,.33,2)
    fastener=material('MD | dark zinc fastener heads',(.18,.20,.23),.9,.29,4)
    chrome=material('MD | polished rigid steel line',(.65,.68,.72),1,.22,5)
    connector=material('MD | connector latch',(.16,.075,.025),.25,.58,7)
    # Defined upper head/cam carrier and lower sump replace the largest crumpled
    # casting patches. The owner's central block and external accessories remain.
    head=[(-.51,-.29),(.49,-.29),(.54,-.24),(.54,.23),(.47,.30),(-.48,.30),(-.54,.24),(-.54,-.23)]
    slab('Head | cast cam carrier',head,.386,.574,alloy,.012)
    slab('Head | machined gasket flange',[(x*1.02,z*1.02) for x,z in head],.385,.400,steel,.002)
    slab('Valve cover | perimeter seal',head,.575,.581,rubber,.002)
    slab('Valve cover | separate upper housing',[(x*.96,z*.96) for x,z in head],.582,.635,polymer,.008)
    for x in [-.42,-.14,.14,.42]:
        bolt('Valve cover | seated fastener',(x,.634,.22),fastener,steel,'y',.013)
        box('Head | foundry stiffening rib',(x,.47,.302),(.026,.14,.022),alloy,.003)
    pan=[(-.47,-.29),(.43,-.29),(.49,-.23),(.49,.26),(.42,.33),(-.42,.33),(-.49,.25),(-.49,-.23)]
    n=len(pan)
    verts=[(x*.88,-.878,z*.85) for x,z in pan]+[(x,-.580,z) for x,z in pan]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh('Sump | tapered cast oil pan',verts,faces,alloy,.012)
    slab('Sump | bolted upper flange',[(x*1.035,z*1.035) for x,z in pan],-.580,-.556,alloy,.004)
    slab('Sump | thin gasket reveal',[(x*1.02,z*1.02) for x,z in pan],-.554,-.549,rubber,.001)
    for x in [-.36,-.18,0,.18,.36]:
        box('Sump | external cast rib',(x,-.727,.297),(.022,.205,.035),alloy,.003)
        bolt('Sump | flange fastener',(x,-.566,.348),fastener,steel,'z',.012)
    bolt('Sump | drain plug',(-.25,-.778,.293),steel,steel,'z',.023)
    outline=[(-.48,-.29),(-.39,-.38),(.44,-.38),(.59,-.24),(.60,.20),(.50,.34),(.20,.39),(.06,.34),(-.17,.39),(-.47,.26)]
    slab('Acoustic cover | sealed lower rim',outline,.737,.751,rubber,.006,-.11)
    # A single faceted shell: thin perimeter reveal, broad planar crown and crisp
    # shoulder chamfers instead of the inflated, pillow-like reconstruction.
    n=len(outline)
    cover=[(x,.752-.11*z,z) for x,z in outline]
    cover += [(x,.857-.11*z,z) for x,z in outline]
    cover += [(x*.91+.012,.900-.11*(z*.86),z*.86) for x,z in outline]
    faces=[tuple(reversed(range(n))),tuple(range(2*n,3*n))]
    faces += [(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(2) for i in range(n)]
    mesh('Acoustic cover | faceted molded shell',cover,faces,polymer,.018)
    for x in [-.24,.30]:
        slab('Cover | shallow reinforcing ridge',[(x-.009,-.22),(x+.009,-.22),(x+.009,.23),(x-.009,.23)],.900,.911,polymer,.003,-.11)
    for x in [-.34,.43]:
        for z in [-.22,.24]:ring('Cover | rubber locating mount',(x,.69,z),.028,.009,.20,rubber,'y',32,.002)
    # Crisp raised oval emblem. Three closed geometric loops, same molded finish.
    for label,cx,cz,rx,rz in [('outer',.04,.015,.103,.071),('cross',.04,.015,.091,.025),('upright',.04,.015,.030,.065)]:
        pts=[]
        for i in range(49):
            a=i/48*TAU; x=cx+rx*math.cos(a); z=cz+rz*math.sin(a)
            pts.append((x,.908-.11*z,z))
        tube('Cover emblem | '+label,pts,.004,polymer,8)
    # Clean separated intake runners. Each has a molded longitudinal seam and flange.
    for i,x in enumerate([-.375,-.125,.125,.375]):
        points=[(x,.28,.37),(x,.23,.61),(x,.05,.71),(x,-.22,.67),(x,-.44,.45)]
        tube(f'Intake runner {i+1:02}',points,.098,polymer,24,oval=.82)
        seam=[(a+.093,b,c) for a,b,c in points]
        tube(f'Intake runner {i+1:02} | mold seam',seam,.0035,polymer,8)
        box(f'Intake flange {i+1:02}',(x,-.42,.405),(.214,.09,.085),polymer,.009)
        box(f'Intake gasket {i+1:02}',(x,-.42,.359),(.210,.081,.006),rubber,.002)
    tube('Intake plenum | common air chamber',[(-.53,.28,.365),(-.25,.28,.365),(.25,.28,.365),(.54,.28,.365)],.105,polymer,32)
    box('Intake | cast mating rail',(0,-.42,.328),(1.03,.105,.045),alloy,.007)
    ring('Throttle bore | aluminum lip',(.555,.28,.365),.109,.083,.055,alloy,'x',64,.004)
    ring('Throttle bore | recessed interior',(.531,.28,.365),.085,.071,.06,rubber,'x',48,.001)
    for x in [-.49,.49]: bolt('Intake mounting bolt',(x,.29,.31),fastener,steel,'y',.016)
    # Flexplate: real holes, individually shaped ring teeth and a machined hub.
    plate=ring('Flexplate | drilled stamped disc',(.613,-.42,0),.432,.058,.019,steel,'x',160,.0012)
    for j in range(8):
        angle=(j+.5)/8*TAU; y=-.42+math.cos(angle)*.28; z=math.sin(angle)*.28
        bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.058,depth=.10,location=xyz((.613,y,z)),rotation=(0,math.pi/2,0))
        cutter=bpy.context.object; mod=plate.modifiers.new('Balancing aperture','BOOLEAN'); mod.operation='DIFFERENCE'; mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    bevel=plate.modifiers.new('Aperture edge chamfers','BEVEL');bevel.width=.0017;bevel.segments=2
    bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=bevel.name)
    ring('Flexplate | machined hub',(.630,-.42,0),.137,.058,.025,steel,'x',96,.002)
    ring('Flexplate | ring gear root',(.605,-.42,0),.447,.424,.034,steel,'x',240,.001)
    teeth=120; verts=[]; faces=[]
    for side in [-.017,.017]:
        for i in range(teeth):
            for phase,r in [(-.45,.443),(-.25,.469),(.25,.469),(.45,.443)]:
                a=(i+phase)/teeth*TAU;verts.append((.605+side,-.42+math.cos(a)*r,math.sin(a)*r))
    n=teeth*4
    # The toothed ring is an annulus: connect the complete outer path to inner rim.
    for side in [-.017,.017]:
        for i in range(n):
            a=(i/4-.45)/teeth*TAU;verts.append((.605+side,-.42+math.cos(a)*.434,math.sin(a)*.434))
    for i in range(n):
        j=(i+1)%n;faces += [(i,j,n+j,n+i),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i),(2*n+i,3*n+i,3*n+j,2*n+j)]
    mesh('Flexplate | 120 beveled starter teeth',verts,faces,steel,.0008)
    for i in range(8):
        a=i/8*TAU;bolt(f'Crank hub socket bolt {i+1:02}',(.648,-.42+math.cos(a)*.102,math.sin(a)*.102),fastener,steel)
    # Highlight existing pipe routes with clean tubes, ferrules and defined joints.
    tube('Fuel rail | rigid formed line',[(-.47,.405,.43),(-.25,.405,.43),(-.17,.46,.43),(.25,.46,.43),(.39,.48,.32)],.012,chrome,16)
    tube('Head conduit | elbow',[(-.39,.48,.18),(-.39,.54,.28),(-.27,.54,.35),(-.06,.54,.35)],.014,chrome,16)
    for x in [-.42,-.22,.20,.34]:ring('Line crimp ferrule',(x,.405 if x<-.22 else .46,.43),.018,.011,.025,steel,'x',32,.001)
    tube('Harness | ribbed protective loom',[(-.47,.52,.28),(-.25,.54,.29),(.12,.54,.29),(.43,.44,.26),(.47,.26,.16)],.018,rubber,12,corrugation=.17)
    box('Harness | sealed connector',(.47,.25,.16),(.075,.058,.06),polymer,.007)
    box('Harness | separate locking tab',(.47,.285,.17),(.042,.008,.03),connector,.002)
    # Separately modeled timing-side service cap, gasket, lip and six fasteners.
    cy,cz=.37,-.28;n=96
    verts=[(x,cy+math.cos(i/n*TAU)*.123,cz+math.sin(i/n*TAU)*.123) for x in [.559,.594] for i in range(n)]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh('Timing | machined service cover',verts,faces,alloy,.0025)
    ring('Timing | gasket reveal',(.555,cy,cz),.127,.116,.006,rubber,'x',96,.001)
    ring('Timing | machined perimeter lip',(.596,cy,cz),.119,.112,.003,steel,'x',96,.0005)
    for i in range(6):
        a=i/6*TAU;bolt(f'Timing cover bolt {i+1:02}',(.589,cy+math.cos(a)*.142,cz+math.sin(a)*.142),fastener,steel,'x',.012)

def cut_soft_parts(base):
    bm=bmesh.new();bm.from_mesh(base.data);bm.faces.ensure_lookup_table();uv=bm.loops.layers.uv.active
    # Read a small working copy only; the authored 4K texture remains untouched.
    image=next((n.image for n in base.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'base color' in n.image.name.lower()),None)
    thumb=None; pixels=None
    if image:
        thumb=image.copy();thumb.scale(512,512);pixels=array.array('f',[0])*(512*512*4);thumb.pixels.foreach_get(pixels)
    removed=0
    for face in list(bm.faces):
        c=gcoord(face.calc_center_median());x,y,z=c
        cover=y>.642
        fly=(x>.465 and (y+.42)**2+z*z<.493**2)
        intake=(z>.44 and -.53<y<.35 and -.57<x<.59)
        if pixels is not None and uv and z>.345 and -.51<y<.39 and -.57<x<.59:
            t=sum((loop[uv].uv for loop in face.loops),Vector((0,0)))/len(face.loops)
            ix=max(0,min(511,int(t.x*511)));iy=max(0,min(511,int(t.y*511)));j=(iy*512+ix)*4
            intake=intake or (pixels[j]+pixels[j+1]+pixels[j+2])/3<.42
        timing=x>.515 and (y-.37)**2+(z+.28)**2<.124**2
        head=.385<y<.643 and abs(x)<.548 and -.305<z<.32
        sump=y<-.545 and abs(x)<.51 and -.32<z<.37
        if cover or fly or intake or timing or head or sump:bm.faces.remove(face);removed+=1
    bm.to_mesh(base.data);bm.free();base.data.update()
    if thumb:bpy.data.images.remove(thumb)
    return removed

reports=[]
for name in ['studio','mobile']:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_DIR/f'engine-{name}.glb'))
    base=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
    base.name='Engine base | preserved casting and housings';base['mdRebuilt']=False
    removed=cut_soft_parts(base);build_parts()
    report={'tier':name,'removedSoftTriangles':removed,'components':[]}
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH' or not obj.get('mdRebuilt'):continue
        # Preserve broad machined faces under raking light instead of interpolating
        # small bevel normals across an entire drilled plate.
        bpy.context.view_layer.objects.active=obj
        normal=obj.modifiers.new('Area weighted mechanical normals','WEIGHTED_NORMAL')
        normal.keep_sharp=True;normal.weight=75
        bpy.ops.object.modifier_apply(modifier=normal.name)
        bm=bmesh.new();bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table();bm.verts.index_update();bm.normal_update()
        cavity=[];curvature=[]
        for v in bm.verts:
            if not v.link_edges:cavity.append(0);curvature.append(0);continue
            neighbors=[e.other_vert(v) for e in v.link_edges]
            delta=sum((n.co-v.co for n in neighbors),Vector())/len(neighbors)
            length=sum((n.co-v.co).length for n in neighbors)/len(neighbors)
            cavity.append(min(1,max(0,delta.dot(v.normal)/max(length,.00001)*3)))
            curvature.append(min(1,sum(abs(e.calc_face_angle(0)) for e in v.link_edges)/len(v.link_edges)*2))
        for name_attr,values in [('_CAVITY',cavity),('_CURVATURE',curvature)]:
            attr=obj.data.attributes.get(name_attr) or obj.data.attributes.new(name_attr,'FLOAT','POINT')
            attr.data.foreach_set('value',values)
        report['components'].append({'name':obj.name,'vertices':len(bm.verts),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges)})
        bm.free()
    # Editable master retains every separately named part, before batching.
    if name=='studio':
        bpy.ops.file.pack_all()
        (ROOT/'design/source').mkdir(exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/source/engine-detail-master.blend'),compress=True)
    # Batch repeated hardware by explicit finish. Parts stay disconnected solids,
    # while the web scene pays only one draw per material group, not per bolt.
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH' and obj.get('mdRebuilt'):groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name=mat;objects[0]['mdRebuilt']=True
        if name=='mobile':
            mod=objects[0].modifiers.new('Mobile silhouette-preserving reduction','DECIMATE');mod.ratio=.55
            bpy.ops.object.modifier_apply(modifier=mod.name)
            normal=objects[0].modifiers.new('Mobile weighted normals','WEIGHTED_NORMAL');normal.keep_sharp=True;normal.weight=75
            bpy.ops.object.modifier_apply(modifier=normal.name)
    report['webGroups']=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or not obj.get('mdRebuilt'):continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        edges=sum(not e.is_manifold for e in bm.edges);bm.free()
        report['webGroups'].append({'name':obj.name,'nonManifoldEdges':edges})
        if edges:raise RuntimeError(f'Open edges in web hardware group {obj.name}: {edges}')
    target=SOURCE_DIR/f'engine-rebuilt-{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_image_format='WEBP',export_image_quality=88,
        export_draco_mesh_compression_enable=True,export_draco_position_quantization=16,export_draco_normal_quantization=12,
        export_draco_texcoord_quantization=14,export_extras=True,export_attributes=True,export_animations=False,export_cameras=False,export_lights=False)
    report['bytes']=target.stat().st_size;reports.append(report)
    print('REBUILT_ENGINE',name,'bytes',report['bytes'],'components',len(report['components']),flush=True)
(ROOT/'design/engine-rebuild-report.json').write_text(json.dumps(reports,indent=2)+'\n')
