/* requires enhance and tippy module*/

/* class for align */
class smartpen {
  constructor() {
    this.init();
  }
  init() {
    this.canvas;
    this.context;
    this.data = new Map();
    this.threshold = this.t = 90;
    this.smoothness = this.s = 4*4;
    this.radius = 30;
    this.mode = 0;
    // 0 for Off, 1 for after finish, 2 for realtime
    this.menubar;
    this.menuon = false;
    this.undo;
  }
  initcanvas(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
  }
  // call edge detection
  detect(x1, y1, x, y, ch=1) {
    let newdata = this.context.getImageData(x1, y1, x, y);
    let dst = edgedetect_canny(newdata, ~~(this.t/2), this.t, 7, 2, ch);
    return dst;
  }
  // collects edges
  edge(x1, y1, x, y) {
    let dist = [];
    let temp = this.detect(x1, y1, x, y, 1);
    let l = temp.data;
    for (let i = x1; i<x1+x; i++) {
      for (let j = y1; j<y1+y; j++) {
        let e = l[(j-y1)*x+i-x1];
        if (e>200) {
          dist.push({x: i, y: j});
        }
      }
    }
    return dist;
  }
  // get optimum pts for a stroke
  apply(arr) {
    let n = 3; let th = this.smoothness; let lambda=1.5;
    let pop = []; let clean=[]; let mod1=[]; let mod2=[]; let final=[]; let nearest = []; let pts = [];
    let f = arr.length-1; let f1=0; let f2=0; let prev; let c;
    clean = arr;
    // -----Nearest-----
    for (let i = 0; i<=f; i++) {
      if (this.data[mtool.hash(clean[i])]!=undefined) {
        c = this.data[mtool.hash(clean[i])];
      } else {
        c = this.nearest(clean[i], true); f1++;
      }
      nearest.push(c[0]);
      pts.push(c[1]);
    }
    // console.log("reduced: ", f1);
    this.data = new Map(); f1=0;
    // ----- Continuity Heuristic 1 -----
    for (let i = 0; i<=f; i++) {
      let mean = mtool.average(nearest, i, n);
      let dist = pts[i]; let mind = 10e10; let point = clean[i]; let near=clean[i];
      for (let j =0; j<dist.length; j++) {
        let d = lambda*mtool.distance(point, dist[j])+mtool.distance(mean, dist[j]);
        if (d<mind) {
          mind = d;
          near = dist[j];
        }
      }
      mod1.push(near);
      f1+=mtool.eqlpt(near, nearest[i]); f2+=1;
    }
    // console.log("heuristic 1: ", f1/(f2-f1));
    f1=0; f2=0;
    // -----Continuity Heuristic 2-----
    for (let i = 0; i<=f; i++) {
      let mean = mtool.average(mod1, i, n);
      if (mtool.distance(mean, mod1[i])>th) {
        mod2.push(mean); f1++;
      } else {
        mod2.push(mod1[i]); f2++;
      }
    }
    // console.log("heuristic 2: ",f2/f1);
    return mod2;
  }
  // get optimum pt for a pt
  nearest(point, all = false) {
    let r = this.radius;
    let x1 = Math.max(point.x-Math.floor(r/2), 0);
    let y1 = Math.max(point.y-Math.floor(r/2), 0);
    let x = Math.min(r, this.canvas.width-x1);
    let y = Math.min(r, this.canvas.height-y1);

    let dist = []; let trials=3; this.t=this.threshold;
    while (!dist.length && --trials) {
      dist = this.edge(x1, y1, x, y);
      this.t/=2; this.t=~~this.t;
    }
    let near = point;
    let d; let mind = 900000*100000;
    for (let i =0; i<dist.length; i++) {
      let d = mtool.distance(point, dist[i]);
      if (d<mind) {
        mind = d; near = dist[i];
      }
    }
    this.data[mtool.hash(point)] = [near, dist];
    if (all) {
      return [near, dist];
    } else {
      return near;
    }
  }
  alignR(arr) {
    return this.nearest(arr);
  }
  align(arr) {
    return this.apply(arr);
  }

  /** ********************************************************/
  // UI
  menu(x, y) {
    if (this.menuon) return;
    this.init();
    this.menuon = true;
    let temp = `
        <input type="checkbox" id="align_flag1" style="display:none;">
        <input type="checkbox" id="align_flag2" style="display:none;">
        <button id="align_openbtn" style="z-index:602; width:200px; font-size:17px;">Smart-Pen</button>
        <button id="align_mode" class="material-icons">power_settings_new</button>
        <button id="align_undoalign" class="material-icons">fast_rewind</button>
        <button id="align_setting" class="material-icons">tune</button>
        <div id="align_sliders">
          <pre>Radius   </pre><input type="range" id="align_radius" max=70 min=7 value=30><span id="align_r">30</span>
          <br>
          <pre>Threshold</pre><input type="range" id="align_threshold" max=300 min=20 value=90><span id="align_t">90</span>
          <br>
          <pre>Roughness</pre><input type="range" id="align_smooth" max=10 min=1 value=4><span id="align_s">4</span>&nbsp;
        </div>`;

    let dv = document.createElement('div');
    dv.style.textAlign = 'center';
    dv.style.position = 'absolute';
    dv.style.left = x+'%'; dv.style.top = y+'%';
    dv.id = 'align_menu';
    dv.style.zIndex = '601';
    dv.innerHTML = temp;
    document.getElementsByTagName('BODY')[0].appendChild(dv);
    this.menubar = dv;
    let children = dv.children;
    for (let i = 0; i<children.length; i++) {
      children[i].style.left = x+'%'; children[i].style.top = y+'%'; children[i].style.position = 'fixed';
    }

    let openbtn = document.getElementById('align_openbtn');
    let mode = document.getElementById('align_mode');
    this.undo = document.getElementById('align_undoalign');
    let setting = document.getElementById('align_setting');
    let radius = document.getElementById('align_radius');
    let threshold = document.getElementById('align_threshold');
    let smoothness = document.getElementById('align_smooth');
    let check1 = document.getElementById('align_flag1');
    let check2 = document.getElementById('align_flag2');
    let r = document.getElementById('align_r');
    let s = document.getElementById('align_s');
    let t = document.getElementById('align_t');
    let blink;
    // logo change, blink and width, text
    openbtn.onclick = function() {
      check1.checked=!check1.checked;
      if (!check1.checked) {
        check2.checked=false; openbtn.innerHTML = 'Smart-Pen'; openbtn.className = '';
      } else {
        openbtn.innerHTML = 'auto_graph'; openbtn.className = 'material-icons';
      }
    };
    mode.onclick = () => {
      this.mode = (this.mode+1)%3;
      if (this.mode == 0) {
        mode.style.color='red'; mode.innerHTML='power_settings_new';
        clearInterval(blink); openbtn.style.color='blue';
      }
      if (this.mode == 1) {
        mode.style.color='green'; mode.innerHTML='edit';
        blink=setInterval(() => {
          if (openbtn.style.color=='blue')openbtn.style.color='red'; else openbtn.style.color='blue';
        }, 1000);
      }
      if (this.mode == 2)mode.innerHTML='motion_photos_on';
    };
    // this.undo.onclick;
    setting.onclick = function() {
      check2.checked=!check2.checked;
    };
    radius.onchange = () => {
      this.radius = Number(radius.value); r.innerHTML = this.radius;
    };
    threshold.onchange = () => {
      this.threshold = this.t = Number(threshold.value); t.innerHTML = this.threshold;
    };
    smoothness.onchange = () => {
      this.smoothness = this.s = Number(smoothness.value);
      if (this.smoothness == 10) this.smoothness = 1000; s.innerHTML = this.smoothness;
    };
    tippy(openbtn, {content: 'SmartPen', placement: 'right', delay: 300, theme: 'light-border'});
    tippy(mode, {content: 'Mode', placement: 'right', delay: 300, theme: 'light-border'});
    tippy(this.undo, {content: 'Undo', placement: 'right', delay: 300, theme: 'light-border'});
    tippy(setting, {content: 'Settings', placement: 'right', delay: 300, theme: 'light-border'});
  }
  close() {
    if (!this.menuon) return;
    this.menubar.remove();
    this.menuon = false;
  }
};

/* class for misc math tools */
class mathtoolSmartpen {
// interpolation id: id of pt, p: final pt, b: const, fc: neighbour limit
  gaussianInterpolate(arr, id, p, b=15, fc=1) {
    let f = arr.length;
    let ln = ~~(f*fc);
    let l = id+ln;
    let r = id-ln;
    let dx = p.x-arr[id][0]; let dy = p.y-arr[id][1];
    for (let i=l; i>=r; i--) {
      let y = Math.exp(-(((id-i)/b)**2));
      arr[(i+f)%f][0] += (y*dx); arr[(i+f)%f][1]+= (y*dy);
    }
    return arr;
  }
  // intepolates in between points with max distance c, min distance low, and max points m
  populate(points, c=4, low=2, m=150) {
    let ln = points.length; let dist=[points[0]]; let prev = points[0];
    for (let i = 1; i<ln; i++) {
      let a=prev; let b=points[i];
      let d = this.distance({x: a[0], y: a[1]}, {x: b[0], y: b[1]});
      if (d>=c*c*4) {
        let n = Math.min(~~(Math.sqrt(d)/c), m);
        for (let j=1; j<=n; j++) {
          let x = a[0] + j*(b[0]-a[0])/n; let y = a[1] + j*(b[1]-a[1])/n;
          dist.push([~~x, ~~y]);
        }
        prev = b;
      } else if (d>=low*low) {
        dist.push(b); prev=b;
      }
    }
    return dist;
  }
  // distance function
  distance(pos1, pos2) {
    return (pos1.x-pos2.x)*(pos1.x-pos2.x)+(pos1.y-pos2.y)*(pos1.y-pos2.y);
  }
  // average function
  average(mod1, i, n) {
    let c=0; let mean={x: 0, y: 0};
    for (let j=-n; j<=n; j++) {
      if (i+j>=mod1.length||j==0||(i+j)<0) continue;
      mean.x+=mod1[(i+j)].x;
      mean.y+=mod1[(i+j)].y;
      c+=1;
    }
    mean.x=~~(mean.x/c); mean.y=~~(mean.y/c);
    return mean;
  }
  // equal points
  eqlpt(a, b) {
    return (a.x==b.x && a.y==b.y);
  }
  // point to number
  hash(pt, r=10000) {
    return Math.floor(pt.x)*r+Math.floor(pt.y);
  }
};

let spen = new smartpen();
let mtool = new mathtoolSmartpen();
