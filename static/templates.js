import { ENTITY_TEMPLATES, TEMPLATE_NAMES } from "./scene_schema.js";

const NS = "http://www.w3.org/2000/svg";
const PALETTE = Object.freeze({
  ink: "#46505e", deepInk: "#303946", warm: "#d98f70", rose: "#c97b84",
  gold: "#e8c47c", green: "#86a886", moss: "#657f6a", blue: "#88a9bd",
  deepBlue: "#617f96", night: "#596780", paper: "#f4ead7", cream: "#fff8e9"
});

function node(tag, attrs = {}) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function add(group, tag, attrs) {
  const element = node(tag, attrs);
  group.appendChild(element);
  return element;
}

function repeat(group, count, create) {
  for (let index = 0; index < count; index += 1) create(index);
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const clamp = channel => Math.max(0, Math.min(255, channel + amount));
  return `#${[value >> 16, value >> 8 & 255, value & 255].map(channel => clamp(channel).toString(16).padStart(2, "0")).join("")}`;
}

function detail(group, tag, attrs) {
  return add(group, tag, { "data-art-detail": "true", ...attrs });
}

function renderTemplate(entity) {
  const { templateId, width: w, height: h, params = {} } = entity;
  const color = params.color || (["rain", "river", "puddle", "cloud"].includes(templateId) ? PALETTE.blue : PALETTE.green);
  const accent = params.accent || PALETTE.warm;
  const ink = PALETTE.ink;
  const dark = shade(color, -32);
  const light = shade(color, 38);
  const strokeWidth = Math.max(1.5, Math.min(w, h) * .018);
  const group = node("g", { "data-template": templateId, "data-art-style": "storybook-layered", "stroke-linecap": "round", "stroke-linejoin": "round" });
  const line = { stroke: ink, "stroke-width": strokeWidth, fill: "none" };
  if (templateId === "person") {
    const woman = params.variant === "woman";
    const walking = params.pose === "walking";
    detail(group, "ellipse", { cx:w*.5, cy:h*.965, rx:w*.28, ry:h*.025, fill:PALETTE.night, opacity:.18, stroke:"none" });
    detail(group, "path", { d:`M${w*.36} ${h*.19} Q${w*.5} ${h*.045} ${w*.66} ${h*.19} L${w*.63} ${h*.31} Q${w*.5} ${h*.25} ${w*.37} ${h*.31} Z`, fill:woman ? dark : PALETTE.deepInk, stroke:ink, "stroke-width":strokeWidth });
    add(group, "ellipse", { cx:w*.5, cy:h*.22, rx:w*.105, ry:h*.105, fill:"#efc5a5", stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.43} ${h*.215} Q${w*.46} ${h*.195} ${w*.49} ${h*.215} M${w*.54} ${h*.215} Q${w*.57} ${h*.195} ${w*.6} ${h*.215} M${w*.48} ${h*.26} Q${w*.52} ${h*.275} ${w*.56} ${h*.255}`, ...line, "stroke-width":strokeWidth*.65 });
    detail(group, "path", { d:`M${w*.37} ${h*.31} Q${w*.5} ${h*.27} ${w*.63} ${h*.31} L${w*.73} ${h*.67} Q${w*.5} ${h*.76} ${w*.27} ${h*.67} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.36} ${h*.36} Q${w*.5} ${h*.43} ${w*.64} ${h*.36}`, fill:"none", stroke:light, "stroke-width":strokeWidth*1.5 });
    if (woman) detail(group, "path", { d:`M${w*.35} ${h*.52} L${w*.2} ${h*.82} Q${w*.5} ${h*.9} ${w*.8} ${h*.82} L${w*.65} ${h*.52} Z`, fill:shade(color, 15), stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.35} ${h*.39} Q${w*.22} ${h*.5} ${w*.19} ${h*.66} M${w*.65} ${h*.39} Q${w*.75} ${h*.48} ${w*.79} ${h*.58}`, ...line, stroke:"#efc5a5", "stroke-width":strokeWidth*2.4 });
    const leftFoot = walking ? .31 : .39, rightFoot = walking ? .75 : .61;
    detail(group, "path", { d:`M${w*.43} ${h*.74} L${w*leftFoot} ${h*.94} M${w*.57} ${h*.74} L${w*rightFoot} ${h*.94}`, ...line, stroke:dark, "stroke-width":strokeWidth*3 });
    detail(group, "path", { d:`M${w*(leftFoot-.06)} ${h*.95} Q${w*leftFoot} ${h*.91} ${w*(leftFoot+.1)} ${h*.955} M${w*(rightFoot-.06)} ${h*.95} Q${w*rightFoot} ${h*.91} ${w*(rightFoot+.1)} ${h*.955}`, ...line, stroke:PALETTE.deepInk, "stroke-width":strokeWidth*2 });
  } else if (templateId === "cat") {
    detail(group, "ellipse", { cx:w*.48, cy:h*.92, rx:w*.36, ry:h*.05, fill:PALETTE.night, opacity:.15, stroke:"none" });
    add(group, "ellipse", { cx:w*.46, cy:h*.63, rx:w*.32, ry:h*.25, fill:color, stroke:ink, "stroke-width":strokeWidth });
    add(group, "circle", { cx:w*.68, cy:h*.36, r:h*.2, fill:light, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.54} ${h*.23} L${w*.59} ${h*.02} L${w*.7} ${h*.2} L${w*.83} ${h*.02} L${w*.82} ${h*.29}`, fill:light, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.61} ${h*.36} L${w*.65} ${h*.36} M${w*.75} ${h*.36} L${w*.79} ${h*.36} M${w*.69} ${h*.43} Q${w*.72} ${h*.46} ${w*.75} ${h*.43}`, ...line });
    detail(group, "path", { d:`M${w*.64} ${h*.46} L${w*.48} ${h*.43} M${w*.65} ${h*.5} L${w*.47} ${h*.53} M${w*.77} ${h*.46} L${w*.92} ${h*.42} M${w*.77} ${h*.5} L${w*.94} ${h*.54} M${w*.2} ${h*.66} Q0 ${h*.48} ${w*.09} ${h*.23}`, ...line });
    detail(group, "path", { d:`M${w*.33} ${h*.53} Q${w*.46} ${h*.68} ${w*.6} ${h*.53}`, fill:"none", stroke:dark, "stroke-width":strokeWidth });
  } else if (templateId === "dog") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.93, rx:w*.38, ry:h*.05, fill:PALETTE.night, opacity:.15, stroke:"none" });
    add(group, "ellipse", { cx:w*.47, cy:h*.61, rx:w*.32, ry:h*.24, fill:color, stroke:ink, "stroke-width":strokeWidth });
    add(group, "circle", { cx:w*.72, cy:h*.39, r:h*.2, fill:light, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.59} ${h*.27} Q${w*.48} ${h*.05} ${w*.64} ${h*.11} M${w*.8} ${h*.26} Q${w*.94} ${h*.05} ${w*.9} ${h*.32}`, fill:dark, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "ellipse", { cx:w*.83, cy:h*.42, rx:w*.055, ry:h*.04, fill:PALETTE.deepInk, stroke:"none" });
    detail(group, "path", { d:`M${w*.65} ${h*.38} L${w*.68} ${h*.38} M${w*.3} ${h*.72} L${w*.26} ${h*.94} M${w*.58} ${h*.72} L${w*.62} ${h*.94} M${w*.17} ${h*.55} Q0 ${h*.36} ${w*.12} ${h*.22}`, ...line, "stroke-width":strokeWidth*1.6 });
    detail(group, "path", { d:`M${w*.36} ${h*.53} Q${w*.48} ${h*.67} ${w*.61} ${h*.53}`, ...line, stroke:dark });
  } else if (templateId === "bird") {
    const count=Math.max(1,Math.min(8,params.count||3));
    repeat(group,count,index => {
      const x=w*(.14+(index%4)*.23), y=h*(.25+Math.floor(index/4)*.38+(index%2)*.08), size=Math.min(w,h)*(.12+(index%3)*.018);
      detail(group, "path", { d:`M${x-size} ${y} Q${x-size*.45} ${y-size*.72} ${x} ${y} Q${x+size*.45} ${y-size*.72} ${x+size} ${y}`, fill:"none", stroke:index%2?color:dark, "stroke-width":strokeWidth*1.4 });
    });
  } else if (templateId === "umbrella") {
    detail(group, "ellipse", { cx:w*.52, cy:h*.46, rx:w*.44, ry:h*.06, fill:PALETTE.night, opacity:.12, stroke:"none" });
    add(group, "path", { d:`M${w*.05} ${h*.46} Q${w*.5} ${-h*.02} ${w*.95} ${h*.46} Q${w*.84} ${h*.38} ${w*.73} ${h*.46} Q${w*.61} ${h*.36} ${w*.5} ${h*.46} Q${w*.39} ${h*.36} ${w*.27} ${h*.46} Q${w*.16} ${h*.38} ${w*.05} ${h*.46} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.5} ${h*.02} L${w*.5} ${h*.46} M${w*.5} ${h*.02} Q${w*.3} ${h*.13} ${w*.27} ${h*.46} M${w*.5} ${h*.02} Q${w*.7} ${h*.13} ${w*.73} ${h*.46}`, ...line, stroke:light, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.5} ${h*.46} L${w*.5} ${h*.88} Q${w*.5} ${h*.99} ${w*.63} ${h*.92}`, ...line, stroke:dark, "stroke-width":strokeWidth*1.8 });
    detail(group, "circle", { cx:w*.5, cy:h*.025, r:strokeWidth*1.4, fill:accent, stroke:ink });
  } else if (templateId === "streetlamp") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.35, rx:w*.46, ry:h*.3, fill:accent, opacity:.12, stroke:"none" });
    detail(group, "path", { d:`M${w*.5} ${h*.26} L${w*.5} ${h*.92} M${w*.24} ${h*.95} Q${w*.5} ${h*.88} ${w*.76} ${h*.95}`, ...line, "stroke-width":strokeWidth*2.5 });
    add(group, "path", { d:`M${w*.32} ${h*.08} L${w*.68} ${h*.08} L${w*.76} ${h*.31} Q${w*.5} ${h*.4} ${w*.24} ${h*.31} Z`, fill:accent, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.36} ${h*.12} L${w*.32} ${h*.29} M${w*.64} ${h*.12} L${w*.68} ${h*.29}`, ...line, stroke:PALETTE.cream });
  } else if (templateId === "roof") {
    add(group, "path", { d:`M${-w*.03} ${h*.72} L${w*.5} ${h*.06} L${w*1.03} ${h*.72} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.02} ${h*.68} L${w*.5} ${h*.12} L${w*.98} ${h*.68}`, ...line, stroke:light, "stroke-width":strokeWidth*1.8 });
    detail(group, "rect", { x:w*.18, y:h*.66, width:w*.64, height:h*.31, rx:strokeWidth*2, fill:accent, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "rect", { x:w*.43, y:h*.73, width:w*.14, height:h*.24, fill:dark, stroke:ink });
    detail(group, "rect", { x:w*.24, y:h*.74, width:w*.12, height:h*.12, fill:PALETTE.gold, stroke:ink });
    detail(group, "rect", { x:w*.64, y:h*.74, width:w*.12, height:h*.12, fill:PALETTE.gold, stroke:ink });
  } else if (templateId === "house") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.96, rx:w*.44, ry:h*.035, fill:PALETTE.night, opacity:.15, stroke:"none" });
    add(group, "rect", { x:w*.16, y:h*.42, width:w*.68, height:h*.52, rx:strokeWidth*2, fill:accent, stroke:ink, "stroke-width":strokeWidth });
    add(group, "path", { d:`M${w*.07} ${h*.46} L${w*.5} ${h*.08} L${w*.93} ${h*.46} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "rect", { x:w*.42, y:h*.62, width:w*.16, height:h*.32, rx:strokeWidth, fill:dark, stroke:ink, "stroke-width":strokeWidth });
    repeat(group,2,index => detail(group, "rect", { x:w*(.23+index*.43), y:h*.57, width:w*.14, height:h*.16, fill:PALETTE.gold, stroke:ink, "stroke-width":strokeWidth }));
    detail(group, "path", { d:`M${w*.3} ${h*.57} L${w*.3} ${h*.73} M${w*.66} ${h*.57} L${w*.66} ${h*.73}`, ...line, stroke:PALETTE.cream });
    detail(group, "rect", { x:w*.68, y:h*.14, width:w*.1, height:h*.23, fill:dark, stroke:ink, "stroke-width":strokeWidth });
  } else if (templateId === "bridge") {
    detail(group, "path", { d:`M0 ${h*.8} Q${w*.5} ${h*.12} ${w} ${h*.8} L${w} ${h} L0 ${h} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.17} ${h*.82} Q${w*.5} ${h*.32} ${w*.83} ${h*.82} L${w*.73} ${h*.82} Q${w*.5} ${h*.49} ${w*.27} ${h*.82} Z`, fill:PALETTE.paper, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.08} ${h*.59} Q${w*.5} ${h*.02} ${w*.92} ${h*.59}`, ...line, stroke:accent, "stroke-width":strokeWidth*1.8 });
    repeat(group,7,index => detail(group, "line", { x1:w*(.13+index*.12), y1:h*(.51-Math.abs(3-index)*.08), x2:w*(.13+index*.12), y2:h*(.65-Math.abs(3-index)*.045), stroke:ink, "stroke-width":strokeWidth }));
  } else if (templateId === "boat") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.87, rx:w*.45, ry:h*.06, fill:PALETTE.night, opacity:.14, stroke:"none" });
    add(group, "path", { d:`M${w*.08} ${h*.62} Q${w*.5} ${h*.84} ${w*.92} ${h*.62} Q${w*.8} ${h*.94} ${w*.24} ${h*.92} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "line", { x1:w*.5, y1:h*.14, x2:w*.5, y2:h*.68, stroke:ink, "stroke-width":strokeWidth*1.6 });
    detail(group, "path", { d:`M${w*.5} ${h*.16} L${w*.5} ${h*.58} L${w*.16} ${h*.52} Z`, fill:accent, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.5} ${h*.2} L${w*.82} ${h*.55} L${w*.5} ${h*.58} Z`, fill:light, stroke:ink, "stroke-width":strokeWidth });
  } else if (templateId === "bench") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.91, rx:w*.44, ry:h*.05, fill:PALETTE.night, opacity:.14, stroke:"none" });
    repeat(group,3,index => detail(group, "rect", { x:w*.1, y:h*(.22+index*.14), width:w*.8, height:h*.1, rx:strokeWidth*2, fill:index%2?color:light, stroke:ink, "stroke-width":strokeWidth }));
    detail(group, "rect", { x:w*.08, y:h*.66, width:w*.84, height:h*.13, rx:strokeWidth*2, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.18} ${h*.75} L${w*.14} ${h*.94} M${w*.82} ${h*.75} L${w*.86} ${h*.94} M${w*.16} ${h*.25} L${w*.18} ${h*.75} M${w*.84} ${h*.25} L${w*.82} ${h*.75}`, ...line, "stroke-width":strokeWidth*1.7 });
  } else if (templateId === "bicycle") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.9, rx:w*.46, ry:h*.04, fill:PALETTE.night, opacity:.13, stroke:"none" });
    detail(group, "circle", { cx:w*.23, cy:h*.68, r:Math.min(w,h)*.2, fill:"none", stroke:ink, "stroke-width":strokeWidth*1.5 });
    detail(group, "circle", { cx:w*.77, cy:h*.68, r:Math.min(w,h)*.2, fill:"none", stroke:ink, "stroke-width":strokeWidth*1.5 });
    detail(group, "path", { d:`M${w*.23} ${h*.68} L${w*.43} ${h*.37} L${w*.58} ${h*.68} Z M${w*.43} ${h*.37} L${w*.7} ${h*.36} L${w*.77} ${h*.68} M${w*.38} ${h*.32} L${w*.51} ${h*.32} M${w*.68} ${h*.36} L${w*.74} ${h*.25} L${w*.82} ${h*.25}`, ...line, stroke:color, "stroke-width":strokeWidth*1.8 });
    detail(group, "circle", { cx:w*.58, cy:h*.68, r:strokeWidth*2.2, fill:accent, stroke:ink });
  } else if (templateId === "fence") {
    repeat(group,Math.max(4,Math.round(5+(params.density??.5)*5)),index => {
      const count=Math.max(4,Math.round(5+(params.density??.5)*5)), x=index*w/(count-1);
      detail(group, "path", { d:`M${x} ${h*.94} L${x} ${h*.18} L${x+w*.025} ${h*.08} L${x+w*.05} ${h*.18} L${x+w*.05} ${h*.94} Z`, fill:index%2?color:light, stroke:ink, "stroke-width":strokeWidth });
    });
    detail(group, "rect", { x:0, y:h*.42, width:w, height:h*.11, fill:accent, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "rect", { x:0, y:h*.72, width:w, height:h*.11, fill:accent, stroke:ink, "stroke-width":strokeWidth });
  } else if (templateId === "buildings") {
    repeat(group, 6, index => {
      const x=index*w/6, top=h*(.12+(index%3)*.12), bw=w*.18;
      add(group, "rect", { x, y:top, width:bw, height:h-top, rx:strokeWidth, fill:index%2?color:dark, stroke:ink, "stroke-width":strokeWidth });
      repeat(group, 3, row => detail(group, "rect", { x:x+bw*.22, y:top+h*.1+row*h*.2, width:bw*.22, height:h*.09, fill:(index+row)%3 ? PALETTE.gold : PALETTE.night, opacity:.8, stroke:"none" }));
      repeat(group, 3, row => detail(group, "rect", { x:x+bw*.58, y:top+h*.1+row*h*.2, width:bw*.22, height:h*.09, fill:(index+row)%2 ? PALETTE.gold : PALETTE.night, opacity:.7, stroke:"none" }));
    });
  } else if (templateId === "rain") {
    const count = Math.max(4, Math.round(8 + (params.density ?? .5) * 22));
    repeat(group, count, index => {
      const x=(index*47)%w, y=(index*71)%h, length=h*(.045+(index%4)*.012);
      detail(group, "line", { x1:x, y1:y, x2:x+w*.018, y2:y+length, stroke:index%3?color:light, opacity:.48+(index%4)*.12, "stroke-width":Math.max(1.2, strokeWidth*(.55+(index%3)*.22)) });
    });
    repeat(group, Math.max(2, Math.round(count/7)), index => detail(group, "path", { d:`M${(index*173+w*.12)%w} ${h*(.83+(index%3)*.05)} q${w*.025} ${-h*.025} ${w*.05} 0 M${(index*173+w*.145)%w} ${h*(.83+(index%3)*.05)} l0 ${-h*.04}`, ...line, stroke:light, opacity:.65 }));
  } else if (templateId === "cloud") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.76, rx:w*.43, ry:h*.14, fill:dark, opacity:.24, stroke:"none" });
    repeat(group, 5, index => add(group, "circle", { cx:w*(.16+index*.17), cy:h*(.61-(index%3)*.12), r:h*(.22+(index%2)*.05), fill:index%2?color:light, stroke:ink, "stroke-width":strokeWidth }));
    detail(group, "path", { d:`M${w*.12} ${h*.69} Q${w*.5} ${h*.84} ${w*.88} ${h*.69}`, ...line, stroke:dark });
  } else if (templateId === "sun" || templateId === "moon") {
    detail(group, "circle", { cx:w*.5, cy:h*.5, r:Math.min(w,h)*.49, fill:color||PALETTE.gold, opacity:.16, stroke:"none" });
    add(group, "circle", { cx:w*.5, cy:h*.5, r:Math.min(w,h)*.34, fill:color||PALETTE.gold, stroke:ink, "stroke-width":strokeWidth });
    if (templateId === "sun") repeat(group, 10, index => {
      const a=index*Math.PI/5, r=Math.min(w,h)*.45;
      detail(group, "line", { x1:w*.5+Math.cos(a)*r*.84, y1:h*.5+Math.sin(a)*r*.84, x2:w*.5+Math.cos(a)*r, y2:h*.5+Math.sin(a)*r, stroke:accent, "stroke-width":strokeWidth*1.4 });
    });
    if (templateId === "moon") {
      detail(group, "circle", { cx:w*.66, cy:h*.38, r:Math.min(w,h)*.33, fill:PALETTE.paper, stroke:"none" });
      detail(group, "circle", { cx:w*.36, cy:h*.42, r:Math.min(w,h)*.045, fill:dark, opacity:.25, stroke:"none" });
    }
  } else if (templateId === "stars") {
    const count = Math.max(3, Math.min(30, params.count || Math.round(6+(params.density??.5)*18)));
    repeat(group, count, index => {
      const x=(index*73)%w, y=(index*41)%h, r=2+(index%3);
      detail(group, "path", { d:`M${x-r*2} ${y} L${x+r*2} ${y} M${x} ${y-r*2} L${x} ${y+r*2}`, stroke:color||PALETTE.gold, "stroke-width":r*.75, opacity:.65+(index%3)*.15 });
    });
  } else if (templateId === "tree") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.97, rx:w*.38, ry:h*.035, fill:PALETTE.night, opacity:.15, stroke:"none" });
    add(group, "path", { d:`M${w*.42} ${h*.96} Q${w*.48} ${h*.63} ${w*.38} ${h*.42} Q${w*.5} ${h*.5} ${w*.62} ${h*.42} Q${w*.52} ${h*.63} ${w*.58} ${h*.96} Z`, fill:accent, stroke:ink, "stroke-width":strokeWidth });
    repeat(group, 7, index => add(group, "circle", { cx:w*(.2+(index%4)*.2), cy:h*(.18+Math.floor(index/4)*.22+(index%2)*.05), r:h*(.19+(index%3)*.025), fill:index%3?color:light, stroke:ink, "stroke-width":strokeWidth }));
    repeat(group, 5, index => detail(group, "circle", { cx:w*(.25+(index%3)*.23), cy:h*(.17+(index%2)*.25), r:h*.025, fill:index%2?accent:PALETTE.gold, stroke:"none" }));
  } else if (templateId === "mountain") {
    detail(group, "path", { d:`M0 ${h} L${w*.22} ${h*.34} L${w*.42} ${h} Z`, fill:light, stroke:ink, "stroke-width":strokeWidth });
    add(group, "path", { d:`M${w*.16} ${h} L${w*.5} ${h*.08} L${w*.72} ${h*.58} L${w*.82} ${h*.28} L${w} ${h} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.39} ${h*.38} L${w*.5} ${h*.08} L${w*.62} ${h*.35} L${w*.54} ${h*.3} L${w*.48} ${h*.38} Z`, fill:PALETTE.paper, stroke:ink, "stroke-width":strokeWidth*.7 });
    detail(group, "path", { d:`M${w*.54} ${h*.3} L${w*.7} ${h*.78} L${w*.62} ${h*.35} Z`, fill:dark, opacity:.42, stroke:"none" });
  } else if (templateId === "flowers") {
    const count = Math.max(3, Math.min(24, params.count || 10));
    repeat(group, count, index => {
      const x=(index*67)%w, y=h*.35+(index%4)*h*.15;
      detail(group, "path", { d:`M${x} ${h} Q${x-w*.03} ${h*.65} ${x} ${y}`, fill:"none", stroke:PALETTE.moss, "stroke-width":Math.max(1.5,strokeWidth) });
      repeat(group, 5, petal => {
        const a=petal*Math.PI*2/5;
        detail(group, "circle", { cx:x+Math.cos(a)*h*.055, cy:y+Math.sin(a)*h*.055, r:Math.max(2,h*.045), fill:index%2?color:accent, stroke:ink, "stroke-width":strokeWidth*.5 });
      });
      detail(group, "circle", { cx:x, cy:y, r:Math.max(2,h*.03), fill:PALETTE.gold, stroke:"none" });
    });
  } else if (templateId === "river" || templateId === "street") {
    add(group, "path", { d:`M0 ${h*.22} Q${w*.35} ${h*.73} ${w*.55} ${h*.34} T${w} ${h*.52} L${w} ${h} Q${w*.65} ${h*.68} ${w*.45} ${h*.92} T0 ${h*.7} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    repeat(group, 4, index => detail(group, "path", { d:`M${w*(.08+index*.22)} ${h*(.48+(index%2)*.17)} q${w*.08} ${h*.06} ${w*.16} 0`, ...line, stroke:templateId==="street"?accent:light, opacity:.75, "stroke-width":strokeWidth*(templateId==="street"?1.5:1) }));
  } else if (templateId === "grass") {
    add(group, "path", { d:`M0 ${h*.42} Q${w*.22} ${h*.25} ${w*.45} ${h*.4} T${w} ${h*.34} L${w} ${h} L0 ${h} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    repeat(group, 22, index => {
      const x=index*w/21, top=h*(.2+(index%5)*.035);
      detail(group, "path", { d:`M${x} ${h*.67} Q${x-w*.015} ${h*.42} ${x-w*.025} ${top} M${x} ${h*.67} Q${x+w*.018} ${h*.43} ${x+w*.035} ${top+h*.04}`, ...line, stroke:index%3?dark:accent, "stroke-width":strokeWidth*.65 });
    });
  } else if (templateId === "puddle") {
    detail(group, "ellipse", { cx:w*.5, cy:h*.62, rx:w*.48, ry:h*.31, fill:PALETTE.night, opacity:.13, stroke:"none" });
    add(group, "path", { d:`M${w*.05} ${h*.55} Q${w*.18} ${h*.24} ${w*.39} ${h*.36} Q${w*.58} ${h*.18} ${w*.75} ${h*.41} Q${w*.96} ${h*.42} ${w*.92} ${h*.68} Q${w*.7} ${h*.93} ${w*.48} ${h*.78} Q${w*.2} ${h*.94} ${w*.05} ${h*.55} Z`, fill:color, stroke:ink, "stroke-width":strokeWidth });
    detail(group, "path", { d:`M${w*.2} ${h*.52} Q${w*.38} ${h*.42} ${w*.56} ${h*.5} M${w*.47} ${h*.65} Q${w*.65} ${h*.57} ${w*.78} ${h*.64}`, ...line, stroke:light, opacity:.85 });
  }
  return group;
}

export function renderEntity(entity) {
  if (!(entity.templateId in ENTITY_TEMPLATES)) throw new Error("未知实体模板");
  const group = renderTemplate(entity);
  group.setAttribute("data-id", entity.id);
  group.setAttribute("data-name", entity.name);
  const direction = entity.params?.direction === "left" ? ` translate(${entity.width} 0) scale(-1 1)` : "";
  group.setAttribute("transform", `translate(${entity.x} ${entity.y}) rotate(${entity.rotation} ${entity.width/2} ${entity.height/2})${direction}`);
  group.setAttribute("opacity", entity.opacity);
  return group;
}

export { ENTITY_TEMPLATES, TEMPLATE_NAMES, PALETTE };
