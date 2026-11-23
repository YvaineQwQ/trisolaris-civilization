/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Te="srgb",ai="srgb-linear",Ts="linear",Jt="srgb";const Kr="300 es";class oi{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const s=this._listeners[t];if(s!==void 0){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}}const ve=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Ds=Math.PI/180,mr=180/Math.PI;function Mn(){const i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(ve[i&255]+ve[i>>8&255]+ve[i>>16&255]+ve[i>>24&255]+"-"+ve[t&255]+ve[t>>8&255]+"-"+ve[t>>16&15|64]+ve[t>>24&255]+"-"+ve[e&63|128]+ve[e>>8&255]+"-"+ve[e>>16&255]+ve[e>>24&255]+ve[n&255]+ve[n>>8&255]+ve[n>>16&255]+ve[n>>24&255]).toLowerCase()}function we(i,t,e){return Math.max(t,Math.min(e,i))}function fl(i,t){return(i%t+t)%t}function Ls(i,t,e){return(1-e)*i+e*t}function Ye(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Qt(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}class It{constructor(t=0,e=0){It.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(we(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Nt{constructor(t,e,n,s,r,a,o,l,h){Nt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,h)}set(t,e,n,s,r,a,o,l,h){const u=this.elements;return u[0]=t,u[1]=s,u[2]=o,u[3]=e,u[4]=r,u[5]=l,u[6]=n,u[7]=a,u[8]=h,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],h=n[1],u=n[4],p=n[7],d=n[2],m=n[5],_=n[8],g=s[0],f=s[3],c=s[6],b=s[1],E=s[4],M=s[7],C=s[2],A=s[5],R=s[8];return r[0]=a*g+o*b+l*C,r[3]=a*f+o*E+l*A,r[6]=a*c+o*M+l*R,r[1]=h*g+u*b+p*C,r[4]=h*f+u*E+p*A,r[7]=h*c+u*M+p*R,r[2]=d*g+m*b+_*C,r[5]=d*f+m*E+_*A,r[8]=d*c+m*M+_*R,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],h=t[7],u=t[8];return e*a*u-e*o*h-n*r*u+n*o*l+s*r*h-s*a*l}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],h=t[7],u=t[8],p=u*a-o*h,d=o*l-u*r,m=h*r-a*l,_=e*p+n*d+s*m;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const g=1/_;return t[0]=p*g,t[1]=(s*h-u*n)*g,t[2]=(o*n-s*a)*g,t[3]=d*g,t[4]=(u*e-s*l)*g,t[5]=(s*r-o*e)*g,t[6]=m*g,t[7]=(n*l-h*e)*g,t[8]=(a*e-n*r)*g,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){const l=Math.cos(r),h=Math.sin(r);return this.set(n*l,n*h,-n*(l*a+h*o)+a+t,-s*h,s*l,-s*(-h*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Us.makeScale(t,e)),this}rotate(t){return this.premultiply(Us.makeRotation(-t)),this}translate(t,e){return this.premultiply(Us.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Us=new Nt;function So(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function wi(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function pl(){const i=wi("canvas");return i.style.display="block",i}const jr={};function Ei(i){i in jr||(jr[i]=!0,console.warn(i))}function ml(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function gl(i){const t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function _l(i){const t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const qt={enabled:!0,workingColorSpace:ai,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===Jt&&(i.r=an(i.r),i.g=an(i.g),i.b=an(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===Jt&&(i.r=ni(i.r),i.g=ni(i.g),i.b=ni(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===""?Ts:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function an(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function ni(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const Zr=[.64,.33,.3,.6,.15,.06],$r=[.2126,.7152,.0722],Jr=[.3127,.329],Qr=new Nt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ta=new Nt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);qt.define({[ai]:{primaries:Zr,whitePoint:Jr,transfer:Ts,toXYZ:Qr,fromXYZ:ta,luminanceCoefficients:$r,workingColorSpaceConfig:{unpackColorSpace:Te},outputColorSpaceConfig:{drawingBufferColorSpace:Te}},[Te]:{primaries:Zr,whitePoint:Jr,transfer:Jt,toXYZ:Qr,fromXYZ:ta,luminanceCoefficients:$r,outputColorSpaceConfig:{drawingBufferColorSpace:Te}}});let Bn;class xl{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Bn===void 0&&(Bn=wi("canvas")),Bn.width=t.width,Bn.height=t.height;const n=Bn.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Bn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=wi("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=an(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(an(e[n]/255)*255):e[n]=an(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let vl=0;class Eo{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:vl++}),this.uuid=Mn(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Fs(s[a].image)):r.push(Fs(s[a]))}else r=Fs(s);n.url=r}return e||(t.images[this.uuid]=n),n}}function Fs(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?xl.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Ml=0;class ye extends oi{constructor(t=ye.DEFAULT_IMAGE,e=ye.DEFAULT_MAPPING,n=1001,s=1001,r=1006,a=1008,o=1023,l=1009,h=ye.DEFAULT_ANISOTROPY,u=""){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Ml++}),this.uuid=Mn(),this.name="",this.source=new Eo(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=h,this.format=o,this.internalFormat=null,this.type=l,this.offset=new It(0,0),this.repeat=new It(1,1),this.center=new It(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Nt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==300)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case 1e3:t.x=t.x-Math.floor(t.x);break;case 1001:t.x=t.x<0?0:1;break;case 1002:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case 1e3:t.y=t.y-Math.floor(t.y);break;case 1001:t.y=t.y<0?0:1;break;case 1002:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}ye.DEFAULT_IMAGE=null;ye.DEFAULT_MAPPING=300;ye.DEFAULT_ANISOTROPY=1;class oe{constructor(t=0,e=0,n=0,s=1){oe.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r;const l=t.elements,h=l[0],u=l[4],p=l[8],d=l[1],m=l[5],_=l[9],g=l[2],f=l[6],c=l[10];if(Math.abs(u-d)<.01&&Math.abs(p-g)<.01&&Math.abs(_-f)<.01){if(Math.abs(u+d)<.1&&Math.abs(p+g)<.1&&Math.abs(_+f)<.1&&Math.abs(h+m+c-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const E=(h+1)/2,M=(m+1)/2,C=(c+1)/2,A=(u+d)/4,R=(p+g)/4,P=(_+f)/4;return E>M&&E>C?E<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(E),s=A/n,r=R/n):M>C?M<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(M),n=A/s,r=P/s):C<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(C),n=R/r,s=P/r),this.set(n,s,r,e),this}let b=Math.sqrt((f-_)*(f-_)+(p-g)*(p-g)+(d-u)*(d-u));return Math.abs(b)<.001&&(b=1),this.x=(f-_)/b,this.y=(p-g)/b,this.z=(d-u)/b,this.w=Math.acos((h+m+c-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class yl extends oi{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new oe(0,0,t,e),this.scissorTest=!1,this.viewport=new oe(0,0,t,e);const s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new ye(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Eo(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Nn extends yl{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class bo extends ye{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Sl extends ye{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Di{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],h=n[s+1],u=n[s+2],p=n[s+3];const d=r[a+0],m=r[a+1],_=r[a+2],g=r[a+3];if(o===0){t[e+0]=l,t[e+1]=h,t[e+2]=u,t[e+3]=p;return}if(o===1){t[e+0]=d,t[e+1]=m,t[e+2]=_,t[e+3]=g;return}if(p!==g||l!==d||h!==m||u!==_){let f=1-o;const c=l*d+h*m+u*_+p*g,b=c>=0?1:-1,E=1-c*c;if(E>Number.EPSILON){const C=Math.sqrt(E),A=Math.atan2(C,c*b);f=Math.sin(f*A)/C,o=Math.sin(o*A)/C}const M=o*b;if(l=l*f+d*M,h=h*f+m*M,u=u*f+_*M,p=p*f+g*M,f===1-o){const C=1/Math.sqrt(l*l+h*h+u*u+p*p);l*=C,h*=C,u*=C,p*=C}}t[e]=l,t[e+1]=h,t[e+2]=u,t[e+3]=p}static multiplyQuaternionsFlat(t,e,n,s,r,a){const o=n[s],l=n[s+1],h=n[s+2],u=n[s+3],p=r[a],d=r[a+1],m=r[a+2],_=r[a+3];return t[e]=o*_+u*p+l*m-h*d,t[e+1]=l*_+u*d+h*p-o*m,t[e+2]=h*_+u*m+o*d-l*p,t[e+3]=u*_-o*p-l*d-h*m,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,h=o(n/2),u=o(s/2),p=o(r/2),d=l(n/2),m=l(s/2),_=l(r/2);switch(a){case"XYZ":this._x=d*u*p+h*m*_,this._y=h*m*p-d*u*_,this._z=h*u*_+d*m*p,this._w=h*u*p-d*m*_;break;case"YXZ":this._x=d*u*p+h*m*_,this._y=h*m*p-d*u*_,this._z=h*u*_-d*m*p,this._w=h*u*p+d*m*_;break;case"ZXY":this._x=d*u*p-h*m*_,this._y=h*m*p+d*u*_,this._z=h*u*_+d*m*p,this._w=h*u*p-d*m*_;break;case"ZYX":this._x=d*u*p-h*m*_,this._y=h*m*p+d*u*_,this._z=h*u*_-d*m*p,this._w=h*u*p+d*m*_;break;case"YZX":this._x=d*u*p+h*m*_,this._y=h*m*p+d*u*_,this._z=h*u*_-d*m*p,this._w=h*u*p-d*m*_;break;case"XZY":this._x=d*u*p-h*m*_,this._y=h*m*p-d*u*_,this._z=h*u*_+d*m*p,this._w=h*u*p+d*m*_;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],h=e[2],u=e[6],p=e[10],d=n+o+p;if(d>0){const m=.5/Math.sqrt(d+1);this._w=.25/m,this._x=(u-l)*m,this._y=(r-h)*m,this._z=(a-s)*m}else if(n>o&&n>p){const m=2*Math.sqrt(1+n-o-p);this._w=(u-l)/m,this._x=.25*m,this._y=(s+a)/m,this._z=(r+h)/m}else if(o>p){const m=2*Math.sqrt(1+o-n-p);this._w=(r-h)/m,this._x=(s+a)/m,this._y=.25*m,this._z=(l+u)/m}else{const m=2*Math.sqrt(1+p-n-o);this._w=(a-s)/m,this._x=(r+h)/m,this._y=(l+u)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(we(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,h=e._z,u=e._w;return this._x=n*u+a*o+s*h-r*l,this._y=s*u+a*l+r*o-n*h,this._z=r*u+a*h+n*l-s*o,this._w=a*u-n*o-s*l-r*h,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,s=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+s*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const m=1-e;return this._w=m*a+e*this._w,this._x=m*n+e*this._x,this._y=m*s+e*this._y,this._z=m*r+e*this._z,this.normalize(),this}const h=Math.sqrt(l),u=Math.atan2(h,o),p=Math.sin((1-e)*u)/h,d=Math.sin(e*u)/h;return this._w=a*p+this._w*d,this._x=n*p+this._x*d,this._y=s*p+this._y*d,this._z=r*p+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class N{constructor(t=0,e=0,n=0){N.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(ea.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(ea.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,h=2*(a*s-o*n),u=2*(o*e-r*s),p=2*(r*n-a*e);return this.x=e+l*h+a*p-o*u,this.y=n+l*u+o*h-r*p,this.z=s+l*p+r*u-a*h,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ns.copy(this).projectOnVector(t),this.sub(Ns)}reflect(t){return this.sub(Ns.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(we(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Ns=new N,ea=new Di;class Li{constructor(t=new N(1/0,1/0,1/0),e=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(Ge.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(Ge.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=Ge.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Ge):Ge.fromBufferAttribute(r,a),Ge.applyMatrix4(t.matrixWorld),this.expandByPoint(Ge);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),zi.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),zi.copy(n.boundingBox)),zi.applyMatrix4(t.matrixWorld),this.union(zi)}const s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Ge),Ge.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(ui),Gi.subVectors(this.max,ui),On.subVectors(t.a,ui),zn.subVectors(t.b,ui),Gn.subVectors(t.c,ui),fn.subVectors(zn,On),pn.subVectors(Gn,zn),bn.subVectors(On,Gn);let e=[0,-fn.z,fn.y,0,-pn.z,pn.y,0,-bn.z,bn.y,fn.z,0,-fn.x,pn.z,0,-pn.x,bn.z,0,-bn.x,-fn.y,fn.x,0,-pn.y,pn.x,0,-bn.y,bn.x,0];return!Is(e,On,zn,Gn,Gi)||(e=[1,0,0,0,1,0,0,0,1],!Is(e,On,zn,Gn,Gi))?!1:(Vi.crossVectors(fn,pn),e=[Vi.x,Vi.y,Vi.z],Is(e,On,zn,Gn,Gi))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Ge).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Ge).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Qe[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Qe[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Qe[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Qe[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Qe[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Qe[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Qe[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Qe[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Qe),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const Qe=[new N,new N,new N,new N,new N,new N,new N,new N],Ge=new N,zi=new Li,On=new N,zn=new N,Gn=new N,fn=new N,pn=new N,bn=new N,ui=new N,Gi=new N,Vi=new N,Tn=new N;function Is(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Tn.fromArray(i,r);const o=s.x*Math.abs(Tn.x)+s.y*Math.abs(Tn.y)+s.z*Math.abs(Tn.z),l=t.dot(Tn),h=e.dot(Tn),u=n.dot(Tn);if(Math.max(-Math.max(l,h,u),Math.min(l,h,u))>o)return!1}return!0}const El=new Li,di=new N,Bs=new N;class Ui{constructor(t=new N,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):El.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;di.subVectors(t,this.center);const e=di.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(di,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Bs.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(di.copy(t.center).add(Bs)),this.expandByPoint(di.copy(t.center).sub(Bs))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const tn=new N,Os=new N,Hi=new N,mn=new N,zs=new N,ki=new N,Gs=new N;class As{constructor(t=new N,e=new N(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,tn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=tn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(tn.copy(this.origin).addScaledVector(this.direction,e),tn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Os.copy(t).add(e).multiplyScalar(.5),Hi.copy(e).sub(t).normalize(),mn.copy(this.origin).sub(Os);const r=t.distanceTo(e)*.5,a=-this.direction.dot(Hi),o=mn.dot(this.direction),l=-mn.dot(Hi),h=mn.lengthSq(),u=Math.abs(1-a*a);let p,d,m,_;if(u>0)if(p=a*l-o,d=a*o-l,_=r*u,p>=0)if(d>=-_)if(d<=_){const g=1/u;p*=g,d*=g,m=p*(p+a*d+2*o)+d*(a*p+d+2*l)+h}else d=r,p=Math.max(0,-(a*d+o)),m=-p*p+d*(d+2*l)+h;else d=-r,p=Math.max(0,-(a*d+o)),m=-p*p+d*(d+2*l)+h;else d<=-_?(p=Math.max(0,-(-a*r+o)),d=p>0?-r:Math.min(Math.max(-r,-l),r),m=-p*p+d*(d+2*l)+h):d<=_?(p=0,d=Math.min(Math.max(-r,-l),r),m=d*(d+2*l)+h):(p=Math.max(0,-(a*r+o)),d=p>0?r:Math.min(Math.max(-r,-l),r),m=-p*p+d*(d+2*l)+h);else d=a>0?-r:r,p=Math.max(0,-(a*d+o)),m=-p*p+d*(d+2*l)+h;return n&&n.copy(this.origin).addScaledVector(this.direction,p),s&&s.copy(Os).addScaledVector(Hi,d),m}intersectSphere(t,e){tn.subVectors(t.center,this.origin);const n=tn.dot(this.direction),s=tn.dot(tn)-n*n,r=t.radius*t.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l;const h=1/this.direction.x,u=1/this.direction.y,p=1/this.direction.z,d=this.origin;return h>=0?(n=(t.min.x-d.x)*h,s=(t.max.x-d.x)*h):(n=(t.max.x-d.x)*h,s=(t.min.x-d.x)*h),u>=0?(r=(t.min.y-d.y)*u,a=(t.max.y-d.y)*u):(r=(t.max.y-d.y)*u,a=(t.min.y-d.y)*u),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),p>=0?(o=(t.min.z-d.z)*p,l=(t.max.z-d.z)*p):(o=(t.max.z-d.z)*p,l=(t.min.z-d.z)*p),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,tn)!==null}intersectTriangle(t,e,n,s,r){zs.subVectors(e,t),ki.subVectors(n,t),Gs.crossVectors(zs,ki);let a=this.direction.dot(Gs),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;mn.subVectors(this.origin,t);const l=o*this.direction.dot(ki.crossVectors(mn,ki));if(l<0)return null;const h=o*this.direction.dot(zs.cross(mn));if(h<0||l+h>a)return null;const u=-o*mn.dot(Gs);return u<0?null:this.at(u/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ne{constructor(t,e,n,s,r,a,o,l,h,u,p,d,m,_,g,f){ne.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,h,u,p,d,m,_,g,f)}set(t,e,n,s,r,a,o,l,h,u,p,d,m,_,g,f){const c=this.elements;return c[0]=t,c[4]=e,c[8]=n,c[12]=s,c[1]=r,c[5]=a,c[9]=o,c[13]=l,c[2]=h,c[6]=u,c[10]=p,c[14]=d,c[3]=m,c[7]=_,c[11]=g,c[15]=f,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ne().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,s=1/Vn.setFromMatrixColumn(t,0).length(),r=1/Vn.setFromMatrixColumn(t,1).length(),a=1/Vn.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),h=Math.sin(s),u=Math.cos(r),p=Math.sin(r);if(t.order==="XYZ"){const d=a*u,m=a*p,_=o*u,g=o*p;e[0]=l*u,e[4]=-l*p,e[8]=h,e[1]=m+_*h,e[5]=d-g*h,e[9]=-o*l,e[2]=g-d*h,e[6]=_+m*h,e[10]=a*l}else if(t.order==="YXZ"){const d=l*u,m=l*p,_=h*u,g=h*p;e[0]=d+g*o,e[4]=_*o-m,e[8]=a*h,e[1]=a*p,e[5]=a*u,e[9]=-o,e[2]=m*o-_,e[6]=g+d*o,e[10]=a*l}else if(t.order==="ZXY"){const d=l*u,m=l*p,_=h*u,g=h*p;e[0]=d-g*o,e[4]=-a*p,e[8]=_+m*o,e[1]=m+_*o,e[5]=a*u,e[9]=g-d*o,e[2]=-a*h,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const d=a*u,m=a*p,_=o*u,g=o*p;e[0]=l*u,e[4]=_*h-m,e[8]=d*h+g,e[1]=l*p,e[5]=g*h+d,e[9]=m*h-_,e[2]=-h,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const d=a*l,m=a*h,_=o*l,g=o*h;e[0]=l*u,e[4]=g-d*p,e[8]=_*p+m,e[1]=p,e[5]=a*u,e[9]=-o*u,e[2]=-h*u,e[6]=m*p+_,e[10]=d-g*p}else if(t.order==="XZY"){const d=a*l,m=a*h,_=o*l,g=o*h;e[0]=l*u,e[4]=-p,e[8]=h*u,e[1]=d*p+g,e[5]=a*u,e[9]=m*p-_,e[2]=_*p-m,e[6]=o*u,e[10]=g*p+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(bl,t,Tl)}lookAt(t,e,n){const s=this.elements;return Ce.subVectors(t,e),Ce.lengthSq()===0&&(Ce.z=1),Ce.normalize(),gn.crossVectors(n,Ce),gn.lengthSq()===0&&(Math.abs(n.z)===1?Ce.x+=1e-4:Ce.z+=1e-4,Ce.normalize(),gn.crossVectors(n,Ce)),gn.normalize(),Wi.crossVectors(Ce,gn),s[0]=gn.x,s[4]=Wi.x,s[8]=Ce.x,s[1]=gn.y,s[5]=Wi.y,s[9]=Ce.y,s[2]=gn.z,s[6]=Wi.z,s[10]=Ce.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],h=n[12],u=n[1],p=n[5],d=n[9],m=n[13],_=n[2],g=n[6],f=n[10],c=n[14],b=n[3],E=n[7],M=n[11],C=n[15],A=s[0],R=s[4],P=s[8],S=s[12],x=s[1],w=s[5],I=s[9],B=s[13],O=s[2],G=s[6],W=s[10],Z=s[14],k=s[3],tt=s[7],lt=s[11],vt=s[15];return r[0]=a*A+o*x+l*O+h*k,r[4]=a*R+o*w+l*G+h*tt,r[8]=a*P+o*I+l*W+h*lt,r[12]=a*S+o*B+l*Z+h*vt,r[1]=u*A+p*x+d*O+m*k,r[5]=u*R+p*w+d*G+m*tt,r[9]=u*P+p*I+d*W+m*lt,r[13]=u*S+p*B+d*Z+m*vt,r[2]=_*A+g*x+f*O+c*k,r[6]=_*R+g*w+f*G+c*tt,r[10]=_*P+g*I+f*W+c*lt,r[14]=_*S+g*B+f*Z+c*vt,r[3]=b*A+E*x+M*O+C*k,r[7]=b*R+E*w+M*G+C*tt,r[11]=b*P+E*I+M*W+C*lt,r[15]=b*S+E*B+M*Z+C*vt,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],h=t[13],u=t[2],p=t[6],d=t[10],m=t[14],_=t[3],g=t[7],f=t[11],c=t[15];return _*(+r*l*p-s*h*p-r*o*d+n*h*d+s*o*m-n*l*m)+g*(+e*l*m-e*h*d+r*a*d-s*a*m+s*h*u-r*l*u)+f*(+e*h*p-e*o*m-r*a*p+n*a*m+r*o*u-n*h*u)+c*(-s*o*u-e*l*p+e*o*d+s*a*p-n*a*d+n*l*u)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],h=t[7],u=t[8],p=t[9],d=t[10],m=t[11],_=t[12],g=t[13],f=t[14],c=t[15],b=p*f*h-g*d*h+g*l*m-o*f*m-p*l*c+o*d*c,E=_*d*h-u*f*h-_*l*m+a*f*m+u*l*c-a*d*c,M=u*g*h-_*p*h+_*o*m-a*g*m-u*o*c+a*p*c,C=_*p*l-u*g*l-_*o*d+a*g*d+u*o*f-a*p*f,A=e*b+n*E+s*M+r*C;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/A;return t[0]=b*R,t[1]=(g*d*r-p*f*r-g*s*m+n*f*m+p*s*c-n*d*c)*R,t[2]=(o*f*r-g*l*r+g*s*h-n*f*h-o*s*c+n*l*c)*R,t[3]=(p*l*r-o*d*r-p*s*h+n*d*h+o*s*m-n*l*m)*R,t[4]=E*R,t[5]=(u*f*r-_*d*r+_*s*m-e*f*m-u*s*c+e*d*c)*R,t[6]=(_*l*r-a*f*r-_*s*h+e*f*h+a*s*c-e*l*c)*R,t[7]=(a*d*r-u*l*r+u*s*h-e*d*h-a*s*m+e*l*m)*R,t[8]=M*R,t[9]=(_*p*r-u*g*r-_*n*m+e*g*m+u*n*c-e*p*c)*R,t[10]=(a*g*r-_*o*r+_*n*h-e*g*h-a*n*c+e*o*c)*R,t[11]=(u*o*r-a*p*r-u*n*h+e*p*h+a*n*m-e*o*m)*R,t[12]=C*R,t[13]=(u*g*s-_*p*s+_*n*d-e*g*d-u*n*f+e*p*f)*R,t[14]=(_*o*s-a*g*s-_*n*l+e*g*l+a*n*f-e*o*f)*R,t[15]=(a*p*s-u*o*s+u*n*l-e*p*l-a*n*d+e*o*d)*R,this}scale(t){const e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,h=r*a,u=r*o;return this.set(h*a+n,h*o-s*l,h*l+s*o,0,h*o+s*l,u*o+n,u*l-s*a,0,h*l-s*o,u*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){const s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,h=r+r,u=a+a,p=o+o,d=r*h,m=r*u,_=r*p,g=a*u,f=a*p,c=o*p,b=l*h,E=l*u,M=l*p,C=n.x,A=n.y,R=n.z;return s[0]=(1-(g+c))*C,s[1]=(m+M)*C,s[2]=(_-E)*C,s[3]=0,s[4]=(m-M)*A,s[5]=(1-(d+c))*A,s[6]=(f+b)*A,s[7]=0,s[8]=(_+E)*R,s[9]=(f-b)*R,s[10]=(1-(d+g))*R,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){const s=this.elements;let r=Vn.set(s[0],s[1],s[2]).length();const a=Vn.set(s[4],s[5],s[6]).length(),o=Vn.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],Ve.copy(this);const h=1/r,u=1/a,p=1/o;return Ve.elements[0]*=h,Ve.elements[1]*=h,Ve.elements[2]*=h,Ve.elements[4]*=u,Ve.elements[5]*=u,Ve.elements[6]*=u,Ve.elements[8]*=p,Ve.elements[9]*=p,Ve.elements[10]*=p,e.setFromRotationMatrix(Ve),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,s,r,a,o=2e3){const l=this.elements,h=2*r/(e-t),u=2*r/(n-s),p=(e+t)/(e-t),d=(n+s)/(n-s);let m,_;if(o===2e3)m=-(a+r)/(a-r),_=-2*a*r/(a-r);else if(o===2001)m=-a/(a-r),_=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=p,l[12]=0,l[1]=0,l[5]=u,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=_,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=2e3){const l=this.elements,h=1/(e-t),u=1/(n-s),p=1/(a-r),d=(e+t)*h,m=(n+s)*u;let _,g;if(o===2e3)_=(a+r)*p,g=-2*p;else if(o===2001)_=r*p,g=-1*p;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*h,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*u,l[9]=0,l[13]=-m,l[2]=0,l[6]=0,l[10]=g,l[14]=-_,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const Vn=new N,Ve=new ne,bl=new N(0,0,0),Tl=new N(1,1,1),gn=new N,Wi=new N,Ce=new N,na=new ne,ia=new Di;class Ze{constructor(t=0,e=0,n=0,s=Ze.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],h=s[5],u=s[9],p=s[2],d=s[6],m=s[10];switch(e){case"XYZ":this._y=Math.asin(we(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,h),this._z=0);break;case"YXZ":this._x=Math.asin(-we(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(l,h)):(this._y=Math.atan2(-p,r),this._z=0);break;case"ZXY":this._x=Math.asin(we(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-p,m),this._z=Math.atan2(-a,h)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-we(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(d,m),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,h));break;case"YZX":this._z=Math.asin(we(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,h),this._y=Math.atan2(-p,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-we(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,h),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-u,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return na.makeRotationFromQuaternion(t),this.setFromRotationMatrix(na,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return ia.setFromEuler(this),this.setFromQuaternion(ia,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Ze.DEFAULT_ORDER="XYZ";class br{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Al=0;const sa=new N,Hn=new Di,en=new ne,Xi=new N,fi=new N,wl=new N,Rl=new Di,ra=new N(1,0,0),aa=new N(0,1,0),oa=new N(0,0,1),la={type:"added"},Cl={type:"removed"},kn={type:"childadded",child:null},Vs={type:"childremoved",child:null};class pe extends oi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Al++}),this.uuid=Mn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=pe.DEFAULT_UP.clone();const t=new N,e=new Ze,n=new Di,s=new N(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ne},normalMatrix:{value:new Nt}}),this.matrix=new ne,this.matrixWorld=new ne,this.matrixAutoUpdate=pe.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=pe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new br,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Hn.setFromAxisAngle(t,e),this.quaternion.multiply(Hn),this}rotateOnWorldAxis(t,e){return Hn.setFromAxisAngle(t,e),this.quaternion.premultiply(Hn),this}rotateX(t){return this.rotateOnAxis(ra,t)}rotateY(t){return this.rotateOnAxis(aa,t)}rotateZ(t){return this.rotateOnAxis(oa,t)}translateOnAxis(t,e){return sa.copy(t).applyQuaternion(this.quaternion),this.position.add(sa.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(ra,t)}translateY(t){return this.translateOnAxis(aa,t)}translateZ(t){return this.translateOnAxis(oa,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(en.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Xi.copy(t):Xi.set(t,e,n);const s=this.parent;this.updateWorldMatrix(!0,!1),fi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?en.lookAt(fi,Xi,this.up):en.lookAt(Xi,fi,this.up),this.quaternion.setFromRotationMatrix(en),s&&(en.extractRotation(s.matrixWorld),Hn.setFromRotationMatrix(en),this.quaternion.premultiply(Hn.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(la),kn.child=t,this.dispatchEvent(kn),kn.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Cl),Vs.child=t,this.dispatchEvent(Vs),Vs.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),en.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),en.multiply(t.parent.matrixWorld)),t.applyMatrix4(en),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(la),kn.child=t,this.dispatchEvent(kn),kn.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(fi,t,wl),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(fi,Rl,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let h=0,u=l.length;h<u;h++){const p=l[h];r(t.shapes,p)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,h=this.material.length;l<h;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),h=a(t.textures),u=a(t.images),p=a(t.shapes),d=a(t.skeletons),m=a(t.animations),_=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),h.length>0&&(n.textures=h),u.length>0&&(n.images=u),p.length>0&&(n.shapes=p),d.length>0&&(n.skeletons=d),m.length>0&&(n.animations=m),_.length>0&&(n.nodes=_)}return n.object=s,n;function a(o){const l=[];for(const h in o){const u=o[h];delete u.metadata,l.push(u)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const s=t.children[n];this.add(s.clone())}return this}}pe.DEFAULT_UP=new N(0,1,0);pe.DEFAULT_MATRIX_AUTO_UPDATE=!0;pe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const He=new N,nn=new N,Hs=new N,sn=new N,Wn=new N,Xn=new N,ca=new N,ks=new N,Ws=new N,Xs=new N,qs=new oe,Ys=new oe,Ks=new oe;class Ie{constructor(t=new N,e=new N,n=new N){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),He.subVectors(t,e),s.cross(He);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){He.subVectors(s,e),nn.subVectors(n,e),Hs.subVectors(t,e);const a=He.dot(He),o=He.dot(nn),l=He.dot(Hs),h=nn.dot(nn),u=nn.dot(Hs),p=a*h-o*o;if(p===0)return r.set(0,0,0),null;const d=1/p,m=(h*l-o*u)*d,_=(a*u-o*l)*d;return r.set(1-m-_,_,m)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,sn)===null?!1:sn.x>=0&&sn.y>=0&&sn.x+sn.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,sn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,sn.x),l.addScaledVector(a,sn.y),l.addScaledVector(o,sn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return qs.setScalar(0),Ys.setScalar(0),Ks.setScalar(0),qs.fromBufferAttribute(t,e),Ys.fromBufferAttribute(t,n),Ks.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(qs,r.x),a.addScaledVector(Ys,r.y),a.addScaledVector(Ks,r.z),a}static isFrontFacing(t,e,n,s){return He.subVectors(n,e),nn.subVectors(t,e),He.cross(nn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return He.subVectors(this.c,this.b),nn.subVectors(this.a,this.b),He.cross(nn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Ie.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Ie.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return Ie.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return Ie.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Ie.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,s=this.b,r=this.c;let a,o;Wn.subVectors(s,n),Xn.subVectors(r,n),ks.subVectors(t,n);const l=Wn.dot(ks),h=Xn.dot(ks);if(l<=0&&h<=0)return e.copy(n);Ws.subVectors(t,s);const u=Wn.dot(Ws),p=Xn.dot(Ws);if(u>=0&&p<=u)return e.copy(s);const d=l*p-u*h;if(d<=0&&l>=0&&u<=0)return a=l/(l-u),e.copy(n).addScaledVector(Wn,a);Xs.subVectors(t,r);const m=Wn.dot(Xs),_=Xn.dot(Xs);if(_>=0&&m<=_)return e.copy(r);const g=m*h-l*_;if(g<=0&&h>=0&&_<=0)return o=h/(h-_),e.copy(n).addScaledVector(Xn,o);const f=u*_-m*p;if(f<=0&&p-u>=0&&m-_>=0)return ca.subVectors(r,s),o=(p-u)/(p-u+(m-_)),e.copy(s).addScaledVector(ca,o);const c=1/(f+g+d);return a=g*c,o=d*c,e.copy(n).addScaledVector(Wn,a).addScaledVector(Xn,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const To={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},_n={h:0,s:0,l:0},qi={h:0,s:0,l:0};function js(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}class gt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Te){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,qt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=qt.workingColorSpace){return this.r=t,this.g=e,this.b=n,qt.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=qt.workingColorSpace){if(t=fl(t,1),e=we(e,0,1),n=we(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=js(a,r,t+1/3),this.g=js(a,r,t),this.b=js(a,r,t-1/3)}return qt.toWorkingColorSpace(this,s),this}setStyle(t,e=Te){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Te){const n=To[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=an(t.r),this.g=an(t.g),this.b=an(t.b),this}copyLinearToSRGB(t){return this.r=ni(t.r),this.g=ni(t.g),this.b=ni(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Te){return qt.fromWorkingColorSpace(Me.copy(this),t),Math.round(we(Me.r*255,0,255))*65536+Math.round(we(Me.g*255,0,255))*256+Math.round(we(Me.b*255,0,255))}getHexString(t=Te){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=qt.workingColorSpace){qt.fromWorkingColorSpace(Me.copy(this),e);const n=Me.r,s=Me.g,r=Me.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,h;const u=(o+a)/2;if(o===a)l=0,h=0;else{const p=a-o;switch(h=u<=.5?p/(a+o):p/(2-a-o),a){case n:l=(s-r)/p+(s<r?6:0);break;case s:l=(r-n)/p+2;break;case r:l=(n-s)/p+4;break}l/=6}return t.h=l,t.s=h,t.l=u,t}getRGB(t,e=qt.workingColorSpace){return qt.fromWorkingColorSpace(Me.copy(this),e),t.r=Me.r,t.g=Me.g,t.b=Me.b,t}getStyle(t=Te){qt.fromWorkingColorSpace(Me.copy(this),t);const e=Me.r,n=Me.g,s=Me.b;return t!==Te?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(_n),this.setHSL(_n.h+t,_n.s+e,_n.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(_n),t.getHSL(qi);const n=Ls(_n.h,qi.h,e),s=Ls(_n.s,qi.s,e),r=Ls(_n.l,qi.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Me=new gt;gt.NAMES=To;let Pl=0;class Sn extends oi{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Pl++}),this.uuid=Mn(),this.name="",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new gt(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==7680&&(n.stencilFail=this.stencilFail),this.stencilZFail!==7680&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==7680&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class Be extends Sn{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new gt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ze,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const de=new N,Yi=new It;class ce{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Yi.fromBufferAttribute(this,e),Yi.applyMatrix3(t),this.setXY(e,Yi.x,Yi.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.applyMatrix3(t),this.setXYZ(e,de.x,de.y,de.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.applyMatrix4(t),this.setXYZ(e,de.x,de.y,de.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.applyNormalMatrix(t),this.setXYZ(e,de.x,de.y,de.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)de.fromBufferAttribute(this,e),de.transformDirection(t),this.setXYZ(e,de.x,de.y,de.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Ye(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Qt(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Ye(e,this.array)),e}setX(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Ye(e,this.array)),e}setY(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Ye(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Ye(e,this.array)),e}setW(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Qt(e,this.array),n=Qt(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Qt(e,this.array),n=Qt(n,this.array),s=Qt(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Qt(e,this.array),n=Qt(n,this.array),s=Qt(s,this.array),r=Qt(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==35044&&(t.usage=this.usage),t}}class Ao extends ce{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class wo extends ce{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class ue extends ce{constructor(t,e,n){super(new Float32Array(t),e,n)}}let Dl=0;const Ue=new ne,Zs=new pe,qn=new N,Pe=new Li,pi=new Li,_e=new N;class he extends oi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Dl++}),this.uuid=Mn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(So(t)?wo:Ao)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Nt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Ue.makeRotationFromQuaternion(t),this.applyMatrix4(Ue),this}rotateX(t){return Ue.makeRotationX(t),this.applyMatrix4(Ue),this}rotateY(t){return Ue.makeRotationY(t),this.applyMatrix4(Ue),this}rotateZ(t){return Ue.makeRotationZ(t),this.applyMatrix4(Ue),this}translate(t,e,n){return Ue.makeTranslation(t,e,n),this.applyMatrix4(Ue),this}scale(t,e,n){return Ue.makeScale(t,e,n),this.applyMatrix4(Ue),this}lookAt(t){return Zs.lookAt(t),Zs.updateMatrix(),this.applyMatrix4(Zs.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(qn).negate(),this.translate(qn.x,qn.y,qn.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let s=0,r=t.length;s<r;s++){const a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ue(n,3))}else{for(let n=0,s=e.count;n<s;n++){const r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Li);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){const r=e[n];Pe.setFromBufferAttribute(r),this.morphTargetsRelative?(_e.addVectors(this.boundingBox.min,Pe.min),this.boundingBox.expandByPoint(_e),_e.addVectors(this.boundingBox.max,Pe.max),this.boundingBox.expandByPoint(_e)):(this.boundingBox.expandByPoint(Pe.min),this.boundingBox.expandByPoint(Pe.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ui);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(t){const n=this.boundingSphere.center;if(Pe.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];pi.setFromBufferAttribute(o),this.morphTargetsRelative?(_e.addVectors(Pe.min,pi.min),Pe.expandByPoint(_e),_e.addVectors(Pe.max,pi.max),Pe.expandByPoint(_e)):(Pe.expandByPoint(pi.min),Pe.expandByPoint(pi.max))}Pe.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)_e.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(_e));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let h=0,u=o.count;h<u;h++)_e.fromBufferAttribute(o,h),l&&(qn.fromBufferAttribute(t,h),_e.add(qn)),s=Math.max(s,n.distanceToSquared(_e))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new ce(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let P=0;P<n.count;P++)o[P]=new N,l[P]=new N;const h=new N,u=new N,p=new N,d=new It,m=new It,_=new It,g=new N,f=new N;function c(P,S,x){h.fromBufferAttribute(n,P),u.fromBufferAttribute(n,S),p.fromBufferAttribute(n,x),d.fromBufferAttribute(r,P),m.fromBufferAttribute(r,S),_.fromBufferAttribute(r,x),u.sub(h),p.sub(h),m.sub(d),_.sub(d);const w=1/(m.x*_.y-_.x*m.y);isFinite(w)&&(g.copy(u).multiplyScalar(_.y).addScaledVector(p,-m.y).multiplyScalar(w),f.copy(p).multiplyScalar(m.x).addScaledVector(u,-_.x).multiplyScalar(w),o[P].add(g),o[S].add(g),o[x].add(g),l[P].add(f),l[S].add(f),l[x].add(f))}let b=this.groups;b.length===0&&(b=[{start:0,count:t.count}]);for(let P=0,S=b.length;P<S;++P){const x=b[P],w=x.start,I=x.count;for(let B=w,O=w+I;B<O;B+=3)c(t.getX(B+0),t.getX(B+1),t.getX(B+2))}const E=new N,M=new N,C=new N,A=new N;function R(P){C.fromBufferAttribute(s,P),A.copy(C);const S=o[P];E.copy(S),E.sub(C.multiplyScalar(C.dot(S))).normalize(),M.crossVectors(A,S);const w=M.dot(l[P])<0?-1:1;a.setXYZW(P,E.x,E.y,E.z,w)}for(let P=0,S=b.length;P<S;++P){const x=b[P],w=x.start,I=x.count;for(let B=w,O=w+I;B<O;B+=3)R(t.getX(B+0)),R(t.getX(B+1)),R(t.getX(B+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new ce(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,m=n.count;d<m;d++)n.setXYZ(d,0,0,0);const s=new N,r=new N,a=new N,o=new N,l=new N,h=new N,u=new N,p=new N;if(t)for(let d=0,m=t.count;d<m;d+=3){const _=t.getX(d+0),g=t.getX(d+1),f=t.getX(d+2);s.fromBufferAttribute(e,_),r.fromBufferAttribute(e,g),a.fromBufferAttribute(e,f),u.subVectors(a,r),p.subVectors(s,r),u.cross(p),o.fromBufferAttribute(n,_),l.fromBufferAttribute(n,g),h.fromBufferAttribute(n,f),o.add(u),l.add(u),h.add(u),n.setXYZ(_,o.x,o.y,o.z),n.setXYZ(g,l.x,l.y,l.z),n.setXYZ(f,h.x,h.y,h.z)}else for(let d=0,m=e.count;d<m;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),u.subVectors(a,r),p.subVectors(s,r),u.cross(p),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)_e.fromBufferAttribute(t,e),_e.normalize(),t.setXYZ(e,_e.x,_e.y,_e.z)}toNonIndexed(){function t(o,l){const h=o.array,u=o.itemSize,p=o.normalized,d=new h.constructor(l.length*u);let m=0,_=0;for(let g=0,f=l.length;g<f;g++){o.isInterleavedBufferAttribute?m=l[g]*o.data.stride+o.offset:m=l[g]*u;for(let c=0;c<u;c++)d[_++]=h[m++]}return new ce(d,u,p)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new he,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],h=t(l,n);e.setAttribute(o,h)}const r=this.morphAttributes;for(const o in r){const l=[],h=r[o];for(let u=0,p=h.length;u<p;u++){const d=h[u],m=t(d,n);l.push(m)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const h=a[o];e.addGroup(h.start,h.count,h.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const h in l)l[h]!==void 0&&(t[h]=l[h]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const h=n[l];t.data.attributes[l]=h.toJSON(t.data)}const s={};let r=!1;for(const l in this.morphAttributes){const h=this.morphAttributes[l],u=[];for(let p=0,d=h.length;p<d;p++){const m=h[p];u.push(m.toJSON(t.data))}u.length>0&&(s[l]=u,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const s=t.attributes;for(const h in s){const u=s[h];this.setAttribute(h,u.clone(e))}const r=t.morphAttributes;for(const h in r){const u=[],p=r[h];for(let d=0,m=p.length;d<m;d++)u.push(p[d].clone(e));this.morphAttributes[h]=u}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let h=0,u=a.length;h<u;h++){const p=a[h];this.addGroup(p.start,p.count,p.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const ha=new ne,An=new As,Ki=new Ui,ua=new N,ji=new N,Zi=new N,$i=new N,$s=new N,Ji=new N,da=new N,Qi=new N;class le extends pe{constructor(t=new he,e=new Be){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);const o=this.morphTargetInfluences;if(r&&o){Ji.set(0,0,0);for(let l=0,h=r.length;l<h;l++){const u=o[l],p=r[l];u!==0&&($s.fromBufferAttribute(p,t),a?Ji.addScaledVector($s,u):Ji.addScaledVector($s.sub(e),u))}e.add(Ji)}return e}raycast(t,e){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Ki.copy(n.boundingSphere),Ki.applyMatrix4(r),An.copy(t.ray).recast(t.near),!(Ki.containsPoint(An.origin)===!1&&(An.intersectSphere(Ki,ua)===null||An.origin.distanceToSquared(ua)>(t.far-t.near)**2))&&(ha.copy(r).invert(),An.copy(t.ray).applyMatrix4(ha),!(n.boundingBox!==null&&An.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,An)))}_computeIntersections(t,e,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,h=r.attributes.uv,u=r.attributes.uv1,p=r.attributes.normal,d=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let _=0,g=d.length;_<g;_++){const f=d[_],c=a[f.materialIndex],b=Math.max(f.start,m.start),E=Math.min(o.count,Math.min(f.start+f.count,m.start+m.count));for(let M=b,C=E;M<C;M+=3){const A=o.getX(M),R=o.getX(M+1),P=o.getX(M+2);s=ts(this,c,t,n,h,u,p,A,R,P),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=f.materialIndex,e.push(s))}}else{const _=Math.max(0,m.start),g=Math.min(o.count,m.start+m.count);for(let f=_,c=g;f<c;f+=3){const b=o.getX(f),E=o.getX(f+1),M=o.getX(f+2);s=ts(this,a,t,n,h,u,p,b,E,M),s&&(s.faceIndex=Math.floor(f/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let _=0,g=d.length;_<g;_++){const f=d[_],c=a[f.materialIndex],b=Math.max(f.start,m.start),E=Math.min(l.count,Math.min(f.start+f.count,m.start+m.count));for(let M=b,C=E;M<C;M+=3){const A=M,R=M+1,P=M+2;s=ts(this,c,t,n,h,u,p,A,R,P),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=f.materialIndex,e.push(s))}}else{const _=Math.max(0,m.start),g=Math.min(l.count,m.start+m.count);for(let f=_,c=g;f<c;f+=3){const b=f,E=f+1,M=f+2;s=ts(this,a,t,n,h,u,p,b,E,M),s&&(s.faceIndex=Math.floor(f/3),e.push(s))}}}}function Ll(i,t,e,n,s,r,a,o){let l;if(t.side===1?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===0,o),l===null)return null;Qi.copy(o),Qi.applyMatrix4(i.matrixWorld);const h=e.ray.origin.distanceTo(Qi);return h<e.near||h>e.far?null:{distance:h,point:Qi.clone(),object:i}}function ts(i,t,e,n,s,r,a,o,l,h){i.getVertexPosition(o,ji),i.getVertexPosition(l,Zi),i.getVertexPosition(h,$i);const u=Ll(i,t,e,n,ji,Zi,$i,da);if(u){const p=new N;Ie.getBarycoord(da,ji,Zi,$i,p),s&&(u.uv=Ie.getInterpolatedAttribute(s,o,l,h,p,new It)),r&&(u.uv1=Ie.getInterpolatedAttribute(r,o,l,h,p,new It)),a&&(u.normal=Ie.getInterpolatedAttribute(a,o,l,h,p,new N),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:l,c:h,normal:new N,materialIndex:0};Ie.getNormal(ji,Zi,$i,d.normal),u.face=d,u.barycoord=p}return u}class Fi extends he{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],h=[],u=[],p=[];let d=0,m=0;_("z","y","x",-1,-1,n,e,t,a,r,0),_("z","y","x",1,-1,n,e,-t,a,r,1),_("x","z","y",1,1,t,n,e,s,a,2),_("x","z","y",1,-1,t,n,-e,s,a,3),_("x","y","z",1,-1,t,e,n,s,r,4),_("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new ue(h,3)),this.setAttribute("normal",new ue(u,3)),this.setAttribute("uv",new ue(p,2));function _(g,f,c,b,E,M,C,A,R,P,S){const x=M/R,w=C/P,I=M/2,B=C/2,O=A/2,G=R+1,W=P+1;let Z=0,k=0;const tt=new N;for(let lt=0;lt<W;lt++){const vt=lt*w-B;for(let Lt=0;Lt<G;Lt++){const Xt=Lt*x-I;tt[g]=Xt*b,tt[f]=vt*E,tt[c]=O,h.push(tt.x,tt.y,tt.z),tt[g]=0,tt[f]=0,tt[c]=A>0?1:-1,u.push(tt.x,tt.y,tt.z),p.push(Lt/R),p.push(1-lt/P),Z+=1}}for(let lt=0;lt<P;lt++)for(let vt=0;vt<R;vt++){const Lt=d+vt+G*lt,Xt=d+vt+G*(lt+1),q=d+(vt+1)+G*(lt+1),Q=d+(vt+1)+G*lt;l.push(Lt,Xt,Q),l.push(Xt,q,Q),k+=6}o.addGroup(m,k,S),m+=k,d+=Z}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Fi(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function si(i){const t={};for(const e in i){t[e]={};for(const n in i[e]){const s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function be(i){const t={};for(let e=0;e<i.length;e++){const n=si(i[e]);for(const s in n)t[s]=n[s]}return t}function Ul(i){const t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Ro(i){const t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:qt.workingColorSpace}const Fl={clone:si,merge:be};var Nl=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Il=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class ln extends Sn{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Nl,this.fragmentShader=Il,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=si(t.uniforms),this.uniformsGroups=Ul(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class Co extends pe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ne,this.projectionMatrix=new ne,this.projectionMatrixInverse=new ne,this.coordinateSystem=2e3}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const xn=new N,fa=new It,pa=new It;class Fe extends Co{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=mr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Ds*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return mr*2*Math.atan(Math.tan(Ds*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){xn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(xn.x,xn.y).multiplyScalar(-t/xn.z),xn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(xn.x,xn.y).multiplyScalar(-t/xn.z)}getViewSize(t,e){return this.getViewBounds(t,fa,pa),e.subVectors(pa,fa)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Ds*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,h=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/h,s*=a.width/l,n*=a.height/h}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const Yn=-90,Kn=1;class Bl extends pe{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Fe(Yn,Kn,t,e);s.layers=this.layers,this.add(s);const r=new Fe(Yn,Kn,t,e);r.layers=this.layers,this.add(r);const a=new Fe(Yn,Kn,t,e);a.layers=this.layers,this.add(a);const o=new Fe(Yn,Kn,t,e);o.layers=this.layers,this.add(o);const l=new Fe(Yn,Kn,t,e);l.layers=this.layers,this.add(l);const h=new Fe(Yn,Kn,t,e);h.layers=this.layers,this.add(h)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(const h of e)this.remove(h);if(t===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const h of e)this.add(h),h.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,h,u]=this.children,p=t.getRenderTarget(),d=t.getActiveCubeFace(),m=t.getActiveMipmapLevel(),_=t.xr.enabled;t.xr.enabled=!1;const g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,a),t.setRenderTarget(n,2,s),t.render(e,o),t.setRenderTarget(n,3,s),t.render(e,l),t.setRenderTarget(n,4,s),t.render(e,h),n.texture.generateMipmaps=g,t.setRenderTarget(n,5,s),t.render(e,u),t.setRenderTarget(p,d,m),t.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class Po extends ye{constructor(t,e,n,s,r,a,o,l,h,u){t=t!==void 0?t:[],e=e!==void 0?e:301,super(t,e,n,s,r,a,o,l,h,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class Ol extends Nn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Po(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:1006}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Fi(5,5,5),r=new ln({name:"CubemapFromEquirect",uniforms:si(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});r.uniforms.tEquirect.value=e;const a=new le(s,r),o=e.minFilter;return e.minFilter===1008&&(e.minFilter=1006),new Bl(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,s){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}}const Js=new N,zl=new N,Gl=new Nt;class Pn{constructor(t=new N(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const s=Js.subVectors(n,e).cross(zl.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Js),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Gl.getNormalMatrix(t),s=this.coplanarPoint(Js).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const wn=new Ui,es=new N;class Tr{constructor(t=new Pn,e=new Pn,n=new Pn,s=new Pn,r=new Pn,a=new Pn){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=2e3){const n=this.planes,s=t.elements,r=s[0],a=s[1],o=s[2],l=s[3],h=s[4],u=s[5],p=s[6],d=s[7],m=s[8],_=s[9],g=s[10],f=s[11],c=s[12],b=s[13],E=s[14],M=s[15];if(n[0].setComponents(l-r,d-h,f-m,M-c).normalize(),n[1].setComponents(l+r,d+h,f+m,M+c).normalize(),n[2].setComponents(l+a,d+u,f+_,M+b).normalize(),n[3].setComponents(l-a,d-u,f-_,M-b).normalize(),n[4].setComponents(l-o,d-p,f-g,M-E).normalize(),e===2e3)n[5].setComponents(l+o,d+p,f+g,M+E).normalize();else if(e===2001)n[5].setComponents(o,p,g,E).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),wn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),wn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(wn)}intersectsSprite(t){return wn.center.set(0,0,0),wn.radius=.7071067811865476,wn.applyMatrix4(t.matrixWorld),this.intersectsSphere(wn)}intersectsSphere(t){const e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const s=e[n];if(es.x=s.normal.x>0?t.max.x:t.min.x,es.y=s.normal.y>0?t.max.y:t.min.y,es.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(es)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Do(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Vl(i){const t=new WeakMap;function e(o,l){const h=o.array,u=o.usage,p=h.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,h,u),o.onUploadCallback();let m;if(h instanceof Float32Array)m=i.FLOAT;else if(h instanceof Uint16Array)o.isFloat16BufferAttribute?m=i.HALF_FLOAT:m=i.UNSIGNED_SHORT;else if(h instanceof Int16Array)m=i.SHORT;else if(h instanceof Uint32Array)m=i.UNSIGNED_INT;else if(h instanceof Int32Array)m=i.INT;else if(h instanceof Int8Array)m=i.BYTE;else if(h instanceof Uint8Array)m=i.UNSIGNED_BYTE;else if(h instanceof Uint8ClampedArray)m=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+h);return{buffer:d,type:m,bytesPerElement:h.BYTES_PER_ELEMENT,version:o.version,size:p}}function n(o,l,h){const u=l.array,p=l.updateRanges;if(i.bindBuffer(h,o),p.length===0)i.bufferSubData(h,0,u);else{p.sort((m,_)=>m.start-_.start);let d=0;for(let m=1;m<p.length;m++){const _=p[d],g=p[m];g.start<=_.start+_.count+1?_.count=Math.max(_.count,g.start+g.count-_.start):(++d,p[d]=g)}p.length=d+1;for(let m=0,_=p.length;m<_;m++){const g=p[m];i.bufferSubData(h,g.start*u.BYTES_PER_ELEMENT,u,g.start,g.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const u=t.get(o);(!u||u.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const h=t.get(o);if(h===void 0)t.set(o,e(o,l));else if(h.version<o.version){if(h.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(h.buffer,o,l),h.version=o.version}}return{get:s,remove:r,update:a}}class ws extends he{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};const r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),h=o+1,u=l+1,p=t/o,d=e/l,m=[],_=[],g=[],f=[];for(let c=0;c<u;c++){const b=c*d-a;for(let E=0;E<h;E++){const M=E*p-r;_.push(M,-b,0),g.push(0,0,1),f.push(E/o),f.push(1-c/l)}}for(let c=0;c<l;c++)for(let b=0;b<o;b++){const E=b+h*c,M=b+h*(c+1),C=b+1+h*(c+1),A=b+1+h*c;m.push(E,M,A),m.push(M,C,A)}this.setIndex(m),this.setAttribute("position",new ue(_,3)),this.setAttribute("normal",new ue(g,3)),this.setAttribute("uv",new ue(f,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ws(t.width,t.height,t.widthSegments,t.heightSegments)}}var Hl=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,kl=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Wl=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Xl=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ql=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Yl=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Kl=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,jl=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Zl=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,$l=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Jl=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Ql=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,tc=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,ec=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,nc=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,ic=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,sc=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,rc=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,ac=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,oc=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,lc=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,cc=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,hc=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,uc=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,dc=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,fc=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,pc=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,mc=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,gc=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,_c=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,xc="gl_FragColor = linearToOutputTexel( gl_FragColor );",vc=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Mc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,yc=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Sc=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Ec=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,bc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Tc=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ac=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,wc=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Rc=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Cc=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Pc=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Dc=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Lc=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Uc=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Fc=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Nc=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ic=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Bc=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Oc=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,zc=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Gc=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Vc=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Hc=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,kc=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Wc=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Xc=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,qc=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Yc=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Kc=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,jc=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Zc=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,$c=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Jc=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Qc=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,th=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,eh=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,nh=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ih=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,sh=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,rh=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,ah=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,oh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,lh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ch=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,hh=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,uh=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,dh=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,fh=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,ph=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,mh=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,gh=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,_h=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,xh=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,vh=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Mh=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,yh=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Sh=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Eh=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,bh=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Th=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Ah=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,wh=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Rh=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Ch=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Ph=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Dh=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Lh=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Uh=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Fh=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Nh=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Ih=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Bh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Oh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,zh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Gh=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Vh=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Hh=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,kh=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Wh=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Xh=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,qh=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yh=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Kh=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,jh=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Zh=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,$h=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Jh=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qh=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,tu=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,eu=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,nu=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,iu=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,su=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ru=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,au=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ou=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,lu=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,cu=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,hu=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,uu=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,du=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,fu=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,pu=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,mu=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,gu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,_u=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,xu=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,vu=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Mu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ot={alphahash_fragment:Hl,alphahash_pars_fragment:kl,alphamap_fragment:Wl,alphamap_pars_fragment:Xl,alphatest_fragment:ql,alphatest_pars_fragment:Yl,aomap_fragment:Kl,aomap_pars_fragment:jl,batching_pars_vertex:Zl,batching_vertex:$l,begin_vertex:Jl,beginnormal_vertex:Ql,bsdfs:tc,iridescence_fragment:ec,bumpmap_pars_fragment:nc,clipping_planes_fragment:ic,clipping_planes_pars_fragment:sc,clipping_planes_pars_vertex:rc,clipping_planes_vertex:ac,color_fragment:oc,color_pars_fragment:lc,color_pars_vertex:cc,color_vertex:hc,common:uc,cube_uv_reflection_fragment:dc,defaultnormal_vertex:fc,displacementmap_pars_vertex:pc,displacementmap_vertex:mc,emissivemap_fragment:gc,emissivemap_pars_fragment:_c,colorspace_fragment:xc,colorspace_pars_fragment:vc,envmap_fragment:Mc,envmap_common_pars_fragment:yc,envmap_pars_fragment:Sc,envmap_pars_vertex:Ec,envmap_physical_pars_fragment:Fc,envmap_vertex:bc,fog_vertex:Tc,fog_pars_vertex:Ac,fog_fragment:wc,fog_pars_fragment:Rc,gradientmap_pars_fragment:Cc,lightmap_pars_fragment:Pc,lights_lambert_fragment:Dc,lights_lambert_pars_fragment:Lc,lights_pars_begin:Uc,lights_toon_fragment:Nc,lights_toon_pars_fragment:Ic,lights_phong_fragment:Bc,lights_phong_pars_fragment:Oc,lights_physical_fragment:zc,lights_physical_pars_fragment:Gc,lights_fragment_begin:Vc,lights_fragment_maps:Hc,lights_fragment_end:kc,logdepthbuf_fragment:Wc,logdepthbuf_pars_fragment:Xc,logdepthbuf_pars_vertex:qc,logdepthbuf_vertex:Yc,map_fragment:Kc,map_pars_fragment:jc,map_particle_fragment:Zc,map_particle_pars_fragment:$c,metalnessmap_fragment:Jc,metalnessmap_pars_fragment:Qc,morphinstance_vertex:th,morphcolor_vertex:eh,morphnormal_vertex:nh,morphtarget_pars_vertex:ih,morphtarget_vertex:sh,normal_fragment_begin:rh,normal_fragment_maps:ah,normal_pars_fragment:oh,normal_pars_vertex:lh,normal_vertex:ch,normalmap_pars_fragment:hh,clearcoat_normal_fragment_begin:uh,clearcoat_normal_fragment_maps:dh,clearcoat_pars_fragment:fh,iridescence_pars_fragment:ph,opaque_fragment:mh,packing:gh,premultiplied_alpha_fragment:_h,project_vertex:xh,dithering_fragment:vh,dithering_pars_fragment:Mh,roughnessmap_fragment:yh,roughnessmap_pars_fragment:Sh,shadowmap_pars_fragment:Eh,shadowmap_pars_vertex:bh,shadowmap_vertex:Th,shadowmask_pars_fragment:Ah,skinbase_vertex:wh,skinning_pars_vertex:Rh,skinning_vertex:Ch,skinnormal_vertex:Ph,specularmap_fragment:Dh,specularmap_pars_fragment:Lh,tonemapping_fragment:Uh,tonemapping_pars_fragment:Fh,transmission_fragment:Nh,transmission_pars_fragment:Ih,uv_pars_fragment:Bh,uv_pars_vertex:Oh,uv_vertex:zh,worldpos_vertex:Gh,background_vert:Vh,background_frag:Hh,backgroundCube_vert:kh,backgroundCube_frag:Wh,cube_vert:Xh,cube_frag:qh,depth_vert:Yh,depth_frag:Kh,distanceRGBA_vert:jh,distanceRGBA_frag:Zh,equirect_vert:$h,equirect_frag:Jh,linedashed_vert:Qh,linedashed_frag:tu,meshbasic_vert:eu,meshbasic_frag:nu,meshlambert_vert:iu,meshlambert_frag:su,meshmatcap_vert:ru,meshmatcap_frag:au,meshnormal_vert:ou,meshnormal_frag:lu,meshphong_vert:cu,meshphong_frag:hu,meshphysical_vert:uu,meshphysical_frag:du,meshtoon_vert:fu,meshtoon_frag:pu,points_vert:mu,points_frag:gu,shadow_vert:_u,shadow_frag:xu,sprite_vert:vu,sprite_frag:Mu},ot={common:{diffuse:{value:new gt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Nt}},envmap:{envMap:{value:null},envMapRotation:{value:new Nt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Nt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Nt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Nt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Nt},normalScale:{value:new It(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Nt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Nt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Nt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Nt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new gt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new gt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0},uvTransform:{value:new Nt}},sprite:{diffuse:{value:new gt(16777215)},opacity:{value:1},center:{value:new It(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}}},qe={basic:{uniforms:be([ot.common,ot.specularmap,ot.envmap,ot.aomap,ot.lightmap,ot.fog]),vertexShader:Ot.meshbasic_vert,fragmentShader:Ot.meshbasic_frag},lambert:{uniforms:be([ot.common,ot.specularmap,ot.envmap,ot.aomap,ot.lightmap,ot.emissivemap,ot.bumpmap,ot.normalmap,ot.displacementmap,ot.fog,ot.lights,{emissive:{value:new gt(0)}}]),vertexShader:Ot.meshlambert_vert,fragmentShader:Ot.meshlambert_frag},phong:{uniforms:be([ot.common,ot.specularmap,ot.envmap,ot.aomap,ot.lightmap,ot.emissivemap,ot.bumpmap,ot.normalmap,ot.displacementmap,ot.fog,ot.lights,{emissive:{value:new gt(0)},specular:{value:new gt(1118481)},shininess:{value:30}}]),vertexShader:Ot.meshphong_vert,fragmentShader:Ot.meshphong_frag},standard:{uniforms:be([ot.common,ot.envmap,ot.aomap,ot.lightmap,ot.emissivemap,ot.bumpmap,ot.normalmap,ot.displacementmap,ot.roughnessmap,ot.metalnessmap,ot.fog,ot.lights,{emissive:{value:new gt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag},toon:{uniforms:be([ot.common,ot.aomap,ot.lightmap,ot.emissivemap,ot.bumpmap,ot.normalmap,ot.displacementmap,ot.gradientmap,ot.fog,ot.lights,{emissive:{value:new gt(0)}}]),vertexShader:Ot.meshtoon_vert,fragmentShader:Ot.meshtoon_frag},matcap:{uniforms:be([ot.common,ot.bumpmap,ot.normalmap,ot.displacementmap,ot.fog,{matcap:{value:null}}]),vertexShader:Ot.meshmatcap_vert,fragmentShader:Ot.meshmatcap_frag},points:{uniforms:be([ot.points,ot.fog]),vertexShader:Ot.points_vert,fragmentShader:Ot.points_frag},dashed:{uniforms:be([ot.common,ot.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ot.linedashed_vert,fragmentShader:Ot.linedashed_frag},depth:{uniforms:be([ot.common,ot.displacementmap]),vertexShader:Ot.depth_vert,fragmentShader:Ot.depth_frag},normal:{uniforms:be([ot.common,ot.bumpmap,ot.normalmap,ot.displacementmap,{opacity:{value:1}}]),vertexShader:Ot.meshnormal_vert,fragmentShader:Ot.meshnormal_frag},sprite:{uniforms:be([ot.sprite,ot.fog]),vertexShader:Ot.sprite_vert,fragmentShader:Ot.sprite_frag},background:{uniforms:{uvTransform:{value:new Nt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ot.background_vert,fragmentShader:Ot.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Nt}},vertexShader:Ot.backgroundCube_vert,fragmentShader:Ot.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ot.cube_vert,fragmentShader:Ot.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ot.equirect_vert,fragmentShader:Ot.equirect_frag},distanceRGBA:{uniforms:be([ot.common,ot.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ot.distanceRGBA_vert,fragmentShader:Ot.distanceRGBA_frag},shadow:{uniforms:be([ot.lights,ot.fog,{color:{value:new gt(0)},opacity:{value:1}}]),vertexShader:Ot.shadow_vert,fragmentShader:Ot.shadow_frag}};qe.physical={uniforms:be([qe.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Nt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Nt},clearcoatNormalScale:{value:new It(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Nt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Nt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Nt},sheen:{value:0},sheenColor:{value:new gt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Nt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Nt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Nt},transmissionSamplerSize:{value:new It},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Nt},attenuationDistance:{value:0},attenuationColor:{value:new gt(0)},specularColor:{value:new gt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Nt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Nt},anisotropyVector:{value:new It},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Nt}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag};const ns={r:0,b:0,g:0},Rn=new Ze,yu=new ne;function Su(i,t,e,n,s,r,a){const o=new gt(0);let l=r===!0?0:1,h,u,p=null,d=0,m=null;function _(b){let E=b.isScene===!0?b.background:null;return E&&E.isTexture&&(E=(b.backgroundBlurriness>0?e:t).get(E)),E}function g(b){let E=!1;const M=_(b);M===null?c(o,l):M&&M.isColor&&(c(M,1),E=!0);const C=i.xr.getEnvironmentBlendMode();C==="additive"?n.buffers.color.setClear(0,0,0,1,a):C==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||E)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function f(b,E){const M=_(E);M&&(M.isCubeTexture||M.mapping===306)?(u===void 0&&(u=new le(new Fi(1,1,1),new ln({name:"BackgroundCubeMaterial",uniforms:si(qe.backgroundCube.uniforms),vertexShader:qe.backgroundCube.vertexShader,fragmentShader:qe.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(C,A,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(u)),Rn.copy(E.backgroundRotation),Rn.x*=-1,Rn.y*=-1,Rn.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(Rn.y*=-1,Rn.z*=-1),u.material.uniforms.envMap.value=M,u.material.uniforms.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(yu.makeRotationFromEuler(Rn)),u.material.toneMapped=qt.getTransfer(M.colorSpace)!==Jt,(p!==M||d!==M.version||m!==i.toneMapping)&&(u.material.needsUpdate=!0,p=M,d=M.version,m=i.toneMapping),u.layers.enableAll(),b.unshift(u,u.geometry,u.material,0,0,null)):M&&M.isTexture&&(h===void 0&&(h=new le(new ws(2,2),new ln({name:"BackgroundMaterial",uniforms:si(qe.background.uniforms),vertexShader:qe.background.vertexShader,fragmentShader:qe.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),Object.defineProperty(h.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(h)),h.material.uniforms.t2D.value=M,h.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,h.material.toneMapped=qt.getTransfer(M.colorSpace)!==Jt,M.matrixAutoUpdate===!0&&M.updateMatrix(),h.material.uniforms.uvTransform.value.copy(M.matrix),(p!==M||d!==M.version||m!==i.toneMapping)&&(h.material.needsUpdate=!0,p=M,d=M.version,m=i.toneMapping),h.layers.enableAll(),b.unshift(h,h.geometry,h.material,0,0,null))}function c(b,E){b.getRGB(ns,Ro(i)),n.buffers.color.setClear(ns.r,ns.g,ns.b,E,a)}return{getClearColor:function(){return o},setClearColor:function(b,E=1){o.set(b),l=E,c(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(b){l=b,c(o,l)},render:g,addToRenderList:f}}function Eu(i,t){const e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,a=!1;function o(x,w,I,B,O){let G=!1;const W=p(B,I,w);r!==W&&(r=W,h(r.object)),G=m(x,B,I,O),G&&_(x,B,I,O),O!==null&&t.update(O,i.ELEMENT_ARRAY_BUFFER),(G||a)&&(a=!1,M(x,w,I,B),O!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(O).buffer))}function l(){return i.createVertexArray()}function h(x){return i.bindVertexArray(x)}function u(x){return i.deleteVertexArray(x)}function p(x,w,I){const B=I.wireframe===!0;let O=n[x.id];O===void 0&&(O={},n[x.id]=O);let G=O[w.id];G===void 0&&(G={},O[w.id]=G);let W=G[B];return W===void 0&&(W=d(l()),G[B]=W),W}function d(x){const w=[],I=[],B=[];for(let O=0;O<e;O++)w[O]=0,I[O]=0,B[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:w,enabledAttributes:I,attributeDivisors:B,object:x,attributes:{},index:null}}function m(x,w,I,B){const O=r.attributes,G=w.attributes;let W=0;const Z=I.getAttributes();for(const k in Z)if(Z[k].location>=0){const lt=O[k];let vt=G[k];if(vt===void 0&&(k==="instanceMatrix"&&x.instanceMatrix&&(vt=x.instanceMatrix),k==="instanceColor"&&x.instanceColor&&(vt=x.instanceColor)),lt===void 0||lt.attribute!==vt||vt&&lt.data!==vt.data)return!0;W++}return r.attributesNum!==W||r.index!==B}function _(x,w,I,B){const O={},G=w.attributes;let W=0;const Z=I.getAttributes();for(const k in Z)if(Z[k].location>=0){let lt=G[k];lt===void 0&&(k==="instanceMatrix"&&x.instanceMatrix&&(lt=x.instanceMatrix),k==="instanceColor"&&x.instanceColor&&(lt=x.instanceColor));const vt={};vt.attribute=lt,lt&&lt.data&&(vt.data=lt.data),O[k]=vt,W++}r.attributes=O,r.attributesNum=W,r.index=B}function g(){const x=r.newAttributes;for(let w=0,I=x.length;w<I;w++)x[w]=0}function f(x){c(x,0)}function c(x,w){const I=r.newAttributes,B=r.enabledAttributes,O=r.attributeDivisors;I[x]=1,B[x]===0&&(i.enableVertexAttribArray(x),B[x]=1),O[x]!==w&&(i.vertexAttribDivisor(x,w),O[x]=w)}function b(){const x=r.newAttributes,w=r.enabledAttributes;for(let I=0,B=w.length;I<B;I++)w[I]!==x[I]&&(i.disableVertexAttribArray(I),w[I]=0)}function E(x,w,I,B,O,G,W){W===!0?i.vertexAttribIPointer(x,w,I,O,G):i.vertexAttribPointer(x,w,I,B,O,G)}function M(x,w,I,B){g();const O=B.attributes,G=I.getAttributes(),W=w.defaultAttributeValues;for(const Z in G){const k=G[Z];if(k.location>=0){let tt=O[Z];if(tt===void 0&&(Z==="instanceMatrix"&&x.instanceMatrix&&(tt=x.instanceMatrix),Z==="instanceColor"&&x.instanceColor&&(tt=x.instanceColor)),tt!==void 0){const lt=tt.normalized,vt=tt.itemSize,Lt=t.get(tt);if(Lt===void 0)continue;const Xt=Lt.buffer,q=Lt.type,Q=Lt.bytesPerElement,xt=q===i.INT||q===i.UNSIGNED_INT||tt.gpuType===1013;if(tt.isInterleavedBufferAttribute){const it=tt.data,Tt=it.stride,Ct=tt.offset;if(it.isInstancedInterleavedBuffer){for(let Bt=0;Bt<k.locationSize;Bt++)c(k.location+Bt,it.meshPerAttribute);x.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=it.meshPerAttribute*it.count)}else for(let Bt=0;Bt<k.locationSize;Bt++)f(k.location+Bt);i.bindBuffer(i.ARRAY_BUFFER,Xt);for(let Bt=0;Bt<k.locationSize;Bt++)E(k.location+Bt,vt/k.locationSize,q,lt,Tt*Q,(Ct+vt/k.locationSize*Bt)*Q,xt)}else{if(tt.isInstancedBufferAttribute){for(let it=0;it<k.locationSize;it++)c(k.location+it,tt.meshPerAttribute);x.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=tt.meshPerAttribute*tt.count)}else for(let it=0;it<k.locationSize;it++)f(k.location+it);i.bindBuffer(i.ARRAY_BUFFER,Xt);for(let it=0;it<k.locationSize;it++)E(k.location+it,vt/k.locationSize,q,lt,vt*Q,vt/k.locationSize*it*Q,xt)}}else if(W!==void 0){const lt=W[Z];if(lt!==void 0)switch(lt.length){case 2:i.vertexAttrib2fv(k.location,lt);break;case 3:i.vertexAttrib3fv(k.location,lt);break;case 4:i.vertexAttrib4fv(k.location,lt);break;default:i.vertexAttrib1fv(k.location,lt)}}}}b()}function C(){P();for(const x in n){const w=n[x];for(const I in w){const B=w[I];for(const O in B)u(B[O].object),delete B[O];delete w[I]}delete n[x]}}function A(x){if(n[x.id]===void 0)return;const w=n[x.id];for(const I in w){const B=w[I];for(const O in B)u(B[O].object),delete B[O];delete w[I]}delete n[x.id]}function R(x){for(const w in n){const I=n[w];if(I[x.id]===void 0)continue;const B=I[x.id];for(const O in B)u(B[O].object),delete B[O];delete I[x.id]}}function P(){S(),a=!0,r!==s&&(r=s,h(r.object))}function S(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:P,resetDefaultState:S,dispose:C,releaseStatesOfGeometry:A,releaseStatesOfProgram:R,initAttributes:g,enableAttribute:f,disableUnusedAttributes:b}}function bu(i,t,e){let n;function s(h){n=h}function r(h,u){i.drawArrays(n,h,u),e.update(u,n,1)}function a(h,u,p){p!==0&&(i.drawArraysInstanced(n,h,u,p),e.update(u,n,p))}function o(h,u,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,h,0,u,0,p);let m=0;for(let _=0;_<p;_++)m+=u[_];e.update(m,n,1)}function l(h,u,p,d){if(p===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let _=0;_<h.length;_++)a(h[_],u[_],d[_]);else{m.multiDrawArraysInstancedWEBGL(n,h,0,u,0,d,0,p);let _=0;for(let g=0;g<p;g++)_+=u[g]*d[g];e.update(_,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Tu(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){const R=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==1023&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const P=R===1016&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(R!==1009&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==1015&&!P)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let h=e.precision!==void 0?e.precision:"highp";const u=l(h);u!==h&&(console.warn("THREE.WebGLRenderer:",h,"not supported, using",u,"instead."),h=u);const p=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),m=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_TEXTURE_SIZE),f=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),c=i.getParameter(i.MAX_VERTEX_ATTRIBS),b=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),E=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),C=_>0,A=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:h,logarithmicDepthBuffer:p,reverseDepthBuffer:d,maxTextures:m,maxVertexTextures:_,maxTextureSize:g,maxCubemapSize:f,maxAttributes:c,maxVertexUniforms:b,maxVaryings:E,maxFragmentUniforms:M,vertexTextures:C,maxSamples:A}}function Au(i){const t=this;let e=null,n=0,s=!1,r=!1;const a=new Pn,o=new Nt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(p,d){const m=p.length!==0||d||n!==0||s;return s=d,n=p.length,m},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(p,d){e=u(p,d,0)},this.setState=function(p,d,m){const _=p.clippingPlanes,g=p.clipIntersection,f=p.clipShadows,c=i.get(p);if(!s||_===null||_.length===0||r&&!f)r?u(null):h();else{const b=r?0:n,E=b*4;let M=c.clippingState||null;l.value=M,M=u(_,d,E,m);for(let C=0;C!==E;++C)M[C]=e[C];c.clippingState=M,this.numIntersection=g?this.numPlanes:0,this.numPlanes+=b}};function h(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function u(p,d,m,_){const g=p!==null?p.length:0;let f=null;if(g!==0){if(f=l.value,_!==!0||f===null){const c=m+g*4,b=d.matrixWorldInverse;o.getNormalMatrix(b),(f===null||f.length<c)&&(f=new Float32Array(c));for(let E=0,M=m;E!==g;++E,M+=4)a.copy(p[E]).applyMatrix4(b,o),a.normal.toArray(f,M),f[M+3]=a.constant}l.value=f,l.needsUpdate=!0}return t.numPlanes=g,t.numIntersection=0,f}}function wu(i){let t=new WeakMap;function e(a,o){return o===303?a.mapping=301:o===304&&(a.mapping=302),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===303||o===304)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const h=new Ol(l.height);return h.fromEquirectangularTexture(i,a),t.set(a,h),a.addEventListener("dispose",s),e(h.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Lo extends Co{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){const h=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=h*this.view.offsetX,a=r+h*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const ti=4,ma=[.125,.215,.35,.446,.526,.582],Ln=20,Qs=new Lo,ga=new gt;let tr=null,er=0,nr=0,ir=!1;const Dn=(1+Math.sqrt(5))/2,jn=1/Dn,_a=[new N(-Dn,jn,0),new N(Dn,jn,0),new N(-jn,0,Dn),new N(jn,0,Dn),new N(0,Dn,-jn),new N(0,Dn,jn),new N(-1,1,-1),new N(1,1,-1),new N(-1,1,1),new N(1,1,1)];class xa{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){tr=this._renderer.getRenderTarget(),er=this._renderer.getActiveCubeFace(),nr=this._renderer.getActiveMipmapLevel(),ir=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ya(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ma(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(tr,er,nr),this._renderer.xr.enabled=ir,t.scissorTest=!1,is(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===301||t.mapping===302?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),tr=this._renderer.getRenderTarget(),er=this._renderer.getActiveCubeFace(),nr=this._renderer.getActiveMipmapLevel(),ir=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:1006,minFilter:1006,generateMipmaps:!1,type:1016,format:1023,colorSpace:ai,depthBuffer:!1},s=va(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=va(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Ru(r)),this._blurMaterial=Cu(r,t,e)}return s}_compileMaterial(t){const e=new le(this._lodPlanes[0],t);this._renderer.compile(e,Qs)}_sceneToCubeUV(t,e,n,s){const o=new Fe(90,1,e,n),l=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,p=u.autoClear,d=u.toneMapping;u.getClearColor(ga),u.toneMapping=0,u.autoClear=!1;const m=new Be({name:"PMREM.Background",side:1,depthWrite:!1,depthTest:!1}),_=new le(new Fi,m);let g=!1;const f=t.background;f?f.isColor&&(m.color.copy(f),t.background=null,g=!0):(m.color.copy(ga),g=!0);for(let c=0;c<6;c++){const b=c%3;b===0?(o.up.set(0,l[c],0),o.lookAt(h[c],0,0)):b===1?(o.up.set(0,0,l[c]),o.lookAt(0,h[c],0)):(o.up.set(0,l[c],0),o.lookAt(0,0,h[c]));const E=this._cubeSize;is(s,b*E,c>2?E:0,E,E),u.setRenderTarget(s),g&&u.render(_,o),u.render(t,o)}_.geometry.dispose(),_.material.dispose(),u.toneMapping=d,u.autoClear=p,t.background=f}_textureToCubeUV(t,e){const n=this._renderer,s=t.mapping===301||t.mapping===302;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=ya()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ma());const r=s?this._cubemapMaterial:this._equirectMaterial,a=new le(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;is(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Qs)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=_a[(s-r-1)%_a.length];this._blur(t,r-1,r,a,o)}e.autoClear=n}_blur(t,e,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){const l=this._renderer,h=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,p=new le(this._lodPlanes[s],h),d=h.uniforms,m=this._sizeLods[n]-1,_=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*Ln-1),g=r/_,f=isFinite(r)?1+Math.floor(u*g):Ln;f>Ln&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${f} samples when the maximum is set to ${Ln}`);const c=[];let b=0;for(let R=0;R<Ln;++R){const P=R/g,S=Math.exp(-P*P/2);c.push(S),R===0?b+=S:R<f&&(b+=2*S)}for(let R=0;R<c.length;R++)c[R]=c[R]/b;d.envMap.value=t.texture,d.samples.value=f,d.weights.value=c,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:E}=this;d.dTheta.value=_,d.mipInt.value=E-n;const M=this._sizeLods[s],C=3*M*(s>E-ti?s-E+ti:0),A=4*(this._cubeSize-M);is(e,C,A,3*M,2*M),l.setRenderTarget(e),l.render(p,Qs)}}function Ru(i){const t=[],e=[],n=[];let s=i;const r=i-ti+1+ma.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);e.push(o);let l=1/o;a>i-ti?l=ma[a-i+ti-1]:a===0&&(l=0),n.push(l);const h=1/(o-2),u=-h,p=1+h,d=[u,u,p,u,p,p,u,u,p,p,u,p],m=6,_=6,g=3,f=2,c=1,b=new Float32Array(g*_*m),E=new Float32Array(f*_*m),M=new Float32Array(c*_*m);for(let A=0;A<m;A++){const R=A%3*2/3-1,P=A>2?0:-1,S=[R,P,0,R+2/3,P,0,R+2/3,P+1,0,R,P,0,R+2/3,P+1,0,R,P+1,0];b.set(S,g*_*A),E.set(d,f*_*A);const x=[A,A,A,A,A,A];M.set(x,c*_*A)}const C=new he;C.setAttribute("position",new ce(b,g)),C.setAttribute("uv",new ce(E,f)),C.setAttribute("faceIndex",new ce(M,c)),t.push(C),s>ti&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function va(i,t,e){const n=new Nn(i,t,e);return n.texture.mapping=306,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function is(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function Cu(i,t,e){const n=new Float32Array(Ln),s=new N(0,1,0);return new ln({name:"SphericalGaussianBlur",defines:{n:Ln,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Ar(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Ma(){return new ln({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ar(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ya(){return new ln({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ar(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Ar(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Pu(i){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,h=l===303||l===304,u=l===301||l===302;if(h||u){let p=t.get(o);const d=p!==void 0?p.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new xa(i)),p=h?e.fromEquirectangular(o,p):e.fromCubemap(o,p),p.texture.pmremVersion=o.pmremVersion,t.set(o,p),p.texture;if(p!==void 0)return p.texture;{const m=o.image;return h&&m&&m.height>0||u&&m&&s(m)?(e===null&&(e=new xa(i)),p=h?e.fromEquirectangular(o):e.fromCubemap(o),p.texture.pmremVersion=o.pmremVersion,t.set(o,p),o.addEventListener("dispose",r),p.texture):null}}}return o}function s(o){let l=0;const h=6;for(let u=0;u<h;u++)o[u]!==void 0&&l++;return l===h}function r(o){const l=o.target;l.removeEventListener("dispose",r);const h=t.get(l);h!==void 0&&(t.delete(l),h.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function Du(i){const t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const s=e(n);return s===null&&Ei("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Lu(i,t,e,n){const s={},r=new WeakMap;function a(p){const d=p.target;d.index!==null&&t.remove(d.index);for(const _ in d.attributes)t.remove(d.attributes[_]);for(const _ in d.morphAttributes){const g=d.morphAttributes[_];for(let f=0,c=g.length;f<c;f++)t.remove(g[f])}d.removeEventListener("dispose",a),delete s[d.id];const m=r.get(d);m&&(t.remove(m),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(p,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,e.memory.geometries++),d}function l(p){const d=p.attributes;for(const _ in d)t.update(d[_],i.ARRAY_BUFFER);const m=p.morphAttributes;for(const _ in m){const g=m[_];for(let f=0,c=g.length;f<c;f++)t.update(g[f],i.ARRAY_BUFFER)}}function h(p){const d=[],m=p.index,_=p.attributes.position;let g=0;if(m!==null){const b=m.array;g=m.version;for(let E=0,M=b.length;E<M;E+=3){const C=b[E+0],A=b[E+1],R=b[E+2];d.push(C,A,A,R,R,C)}}else if(_!==void 0){const b=_.array;g=_.version;for(let E=0,M=b.length/3-1;E<M;E+=3){const C=E+0,A=E+1,R=E+2;d.push(C,A,A,R,R,C)}}else return;const f=new(So(d)?wo:Ao)(d,1);f.version=g;const c=r.get(p);c&&t.remove(c),r.set(p,f)}function u(p){const d=r.get(p);if(d){const m=p.index;m!==null&&d.version<m.version&&h(p)}else h(p);return r.get(p)}return{get:o,update:l,getWireframeAttribute:u}}function Uu(i,t,e){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,m){i.drawElements(n,m,r,d*a),e.update(m,n,1)}function h(d,m,_){_!==0&&(i.drawElementsInstanced(n,m,r,d*a,_),e.update(m,n,_))}function u(d,m,_){if(_===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,m,0,r,d,0,_);let f=0;for(let c=0;c<_;c++)f+=m[c];e.update(f,n,1)}function p(d,m,_,g){if(_===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let c=0;c<d.length;c++)h(d[c]/a,m[c],g[c]);else{f.multiDrawElementsInstancedWEBGL(n,m,0,r,d,0,g,0,_);let c=0;for(let b=0;b<_;b++)c+=m[b]*g[b];e.update(c,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=h,this.renderMultiDraw=u,this.renderMultiDrawInstances=p}function Fu(i){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Nu(i,t,e){const n=new WeakMap,s=new oe;function r(a,o,l){const h=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,p=u!==void 0?u.length:0;let d=n.get(o);if(d===void 0||d.count!==p){let S=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",S)};d!==void 0&&d.texture.dispose();const m=o.morphAttributes.position!==void 0,_=o.morphAttributes.normal!==void 0,g=o.morphAttributes.color!==void 0,f=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],b=o.morphAttributes.color||[];let E=0;m===!0&&(E=1),_===!0&&(E=2),g===!0&&(E=3);let M=o.attributes.position.count*E,C=1;M>t.maxTextureSize&&(C=Math.ceil(M/t.maxTextureSize),M=t.maxTextureSize);const A=new Float32Array(M*C*4*p),R=new bo(A,M,C,p);R.type=1015,R.needsUpdate=!0;const P=E*4;for(let x=0;x<p;x++){const w=f[x],I=c[x],B=b[x],O=M*C*4*x;for(let G=0;G<w.count;G++){const W=G*P;m===!0&&(s.fromBufferAttribute(w,G),A[O+W+0]=s.x,A[O+W+1]=s.y,A[O+W+2]=s.z,A[O+W+3]=0),_===!0&&(s.fromBufferAttribute(I,G),A[O+W+4]=s.x,A[O+W+5]=s.y,A[O+W+6]=s.z,A[O+W+7]=0),g===!0&&(s.fromBufferAttribute(B,G),A[O+W+8]=s.x,A[O+W+9]=s.y,A[O+W+10]=s.z,A[O+W+11]=B.itemSize===4?s.w:1)}}d={count:p,texture:R,size:new It(M,C)},n.set(o,d),o.addEventListener("dispose",S)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let m=0;for(let g=0;g<h.length;g++)m+=h[g];const _=o.morphTargetsRelative?1:1-m;l.getUniforms().setValue(i,"morphTargetBaseInfluence",_),l.getUniforms().setValue(i,"morphTargetInfluences",h)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Iu(i,t,e,n){let s=new WeakMap;function r(l){const h=n.render.frame,u=l.geometry,p=t.get(l,u);if(s.get(p)!==h&&(t.update(p),s.set(p,h)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==h&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,h))),l.isSkinnedMesh){const d=l.skeleton;s.get(d)!==h&&(d.update(),s.set(d,h))}return p}function a(){s=new WeakMap}function o(l){const h=l.target;h.removeEventListener("dispose",o),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:r,dispose:a}}class Uo extends ye{constructor(t,e,n,s,r,a,o,l,h,u=1026){if(u!==1026&&u!==1027)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&u===1026&&(n=1014),n===void 0&&u===1027&&(n=1020),super(null,s,r,a,o,l,u,n,h),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:1003,this.minFilter=l!==void 0?l:1003,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Fo=new ye,Sa=new Uo(1,1),No=new bo,Io=new Sl,Bo=new Po,Ea=[],ba=[],Ta=new Float32Array(16),Aa=new Float32Array(9),wa=new Float32Array(4);function li(i,t,e){const n=i[0];if(n<=0||n>0)return i;const s=t*e;let r=Ea[s];if(r===void 0&&(r=new Float32Array(s),Ea[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function me(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function ge(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function Rs(i,t){let e=ba[t];e===void 0&&(e=new Int32Array(t),ba[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function Bu(i,t){const e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Ou(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(me(e,t))return;i.uniform2fv(this.addr,t),ge(e,t)}}function zu(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(me(e,t))return;i.uniform3fv(this.addr,t),ge(e,t)}}function Gu(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(me(e,t))return;i.uniform4fv(this.addr,t),ge(e,t)}}function Vu(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(me(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),ge(e,t)}else{if(me(e,n))return;wa.set(n),i.uniformMatrix2fv(this.addr,!1,wa),ge(e,n)}}function Hu(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(me(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),ge(e,t)}else{if(me(e,n))return;Aa.set(n),i.uniformMatrix3fv(this.addr,!1,Aa),ge(e,n)}}function ku(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(me(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),ge(e,t)}else{if(me(e,n))return;Ta.set(n),i.uniformMatrix4fv(this.addr,!1,Ta),ge(e,n)}}function Wu(i,t){const e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Xu(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(me(e,t))return;i.uniform2iv(this.addr,t),ge(e,t)}}function qu(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(me(e,t))return;i.uniform3iv(this.addr,t),ge(e,t)}}function Yu(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(me(e,t))return;i.uniform4iv(this.addr,t),ge(e,t)}}function Ku(i,t){const e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function ju(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(me(e,t))return;i.uniform2uiv(this.addr,t),ge(e,t)}}function Zu(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(me(e,t))return;i.uniform3uiv(this.addr,t),ge(e,t)}}function $u(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(me(e,t))return;i.uniform4uiv(this.addr,t),ge(e,t)}}function Ju(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Sa.compareFunction=515,r=Sa):r=Fo,e.setTexture2D(t||r,s)}function Qu(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Io,s)}function td(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Bo,s)}function ed(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||No,s)}function nd(i){switch(i){case 5126:return Bu;case 35664:return Ou;case 35665:return zu;case 35666:return Gu;case 35674:return Vu;case 35675:return Hu;case 35676:return ku;case 5124:case 35670:return Wu;case 35667:case 35671:return Xu;case 35668:case 35672:return qu;case 35669:case 35673:return Yu;case 5125:return Ku;case 36294:return ju;case 36295:return Zu;case 36296:return $u;case 35678:case 36198:case 36298:case 36306:case 35682:return Ju;case 35679:case 36299:case 36307:return Qu;case 35680:case 36300:case 36308:case 36293:return td;case 36289:case 36303:case 36311:case 36292:return ed}}function id(i,t){i.uniform1fv(this.addr,t)}function sd(i,t){const e=li(t,this.size,2);i.uniform2fv(this.addr,e)}function rd(i,t){const e=li(t,this.size,3);i.uniform3fv(this.addr,e)}function ad(i,t){const e=li(t,this.size,4);i.uniform4fv(this.addr,e)}function od(i,t){const e=li(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function ld(i,t){const e=li(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function cd(i,t){const e=li(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function hd(i,t){i.uniform1iv(this.addr,t)}function ud(i,t){i.uniform2iv(this.addr,t)}function dd(i,t){i.uniform3iv(this.addr,t)}function fd(i,t){i.uniform4iv(this.addr,t)}function pd(i,t){i.uniform1uiv(this.addr,t)}function md(i,t){i.uniform2uiv(this.addr,t)}function gd(i,t){i.uniform3uiv(this.addr,t)}function _d(i,t){i.uniform4uiv(this.addr,t)}function xd(i,t,e){const n=this.cache,s=t.length,r=Rs(e,s);me(n,r)||(i.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==s;++a)e.setTexture2D(t[a]||Fo,r[a])}function vd(i,t,e){const n=this.cache,s=t.length,r=Rs(e,s);me(n,r)||(i.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||Io,r[a])}function Md(i,t,e){const n=this.cache,s=t.length,r=Rs(e,s);me(n,r)||(i.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||Bo,r[a])}function yd(i,t,e){const n=this.cache,s=t.length,r=Rs(e,s);me(n,r)||(i.uniform1iv(this.addr,r),ge(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||No,r[a])}function Sd(i){switch(i){case 5126:return id;case 35664:return sd;case 35665:return rd;case 35666:return ad;case 35674:return od;case 35675:return ld;case 35676:return cd;case 5124:case 35670:return hd;case 35667:case 35671:return ud;case 35668:case 35672:return dd;case 35669:case 35673:return fd;case 5125:return pd;case 36294:return md;case 36295:return gd;case 36296:return _d;case 35678:case 36198:case 36298:case 36306:case 35682:return xd;case 35679:case 36299:case 36307:return vd;case 35680:case 36300:case 36308:case 36293:return Md;case 36289:case 36303:case 36311:case 36292:return yd}}class Ed{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=nd(e.type)}}class bd{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Sd(e.type)}}class Td{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(t,e[o.id],n)}}}const sr=/(\w+)(\])?(\[|\.)?/g;function Ra(i,t){i.seq.push(t),i.map[t.id]=t}function Ad(i,t,e){const n=i.name,s=n.length;for(sr.lastIndex=0;;){const r=sr.exec(n),a=sr.lastIndex;let o=r[1];const l=r[2]==="]",h=r[3];if(l&&(o=o|0),h===void 0||h==="["&&a+2===s){Ra(e,h===void 0?new Ed(o,i,t):new bd(o,i,t));break}else{let p=e.map[o];p===void 0&&(p=new Td(o),Ra(e,p)),e=p}}}class _s{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=t.getActiveUniform(e,s),a=t.getUniformLocation(e,r.name);Ad(r,a,this)}}setValue(t,e,n,s){const r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){const s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){const n=[];for(let s=0,r=t.length;s!==r;++s){const a=t[s];a.id in e&&n.push(a)}return n}}function Ca(i,t,e){const n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}const wd=37297;let Rd=0;function Cd(i,t){const e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}const Pa=new Nt;function Pd(i){qt._getMatrix(Pa,qt.workingColorSpace,i);const t=`mat3( ${Pa.elements.map(e=>e.toFixed(4))} )`;switch(qt.getTransfer(i)){case Ts:return[t,"LinearTransferOETF"];case Jt:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Da(i,t,e){const n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+Cd(i.getShaderSource(t),a)}else return s}function Dd(i,t){const e=Pd(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Ld(i,t){let e;switch(t){case 1:e="Linear";break;case 2:e="Reinhard";break;case 3:e="Cineon";break;case 4:e="ACESFilmic";break;case 6:e="AgX";break;case 7:e="Neutral";break;case 5:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const ss=new N;function Ud(){qt.getLuminanceCoefficients(ss);const i=ss.x.toFixed(4),t=ss.y.toFixed(4),e=ss.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Fd(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(bi).join(`
`)}function Nd(i){const t=[];for(const e in i){const n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Id(i,t){const e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(t,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function bi(i){return i!==""}function La(i,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Ua(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Bd=/^[ \t]*#include +<([\w\d./]+)>/gm;function gr(i){return i.replace(Bd,zd)}const Od=new Map;function zd(i,t){let e=Ot[t];if(e===void 0){const n=Od.get(t);if(n!==void 0)e=Ot[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return gr(e)}const Gd=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Fa(i){return i.replace(Gd,Vd)}function Vd(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Na(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Hd(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===1?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===2?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===3&&(t="SHADOWMAP_TYPE_VSM"),t}function kd(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case 301:case 302:t="ENVMAP_TYPE_CUBE";break;case 306:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Wd(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case 302:t="ENVMAP_MODE_REFRACTION";break}return t}function Xd(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case 0:t="ENVMAP_BLENDING_MULTIPLY";break;case 1:t="ENVMAP_BLENDING_MIX";break;case 2:t="ENVMAP_BLENDING_ADD";break}return t}function qd(i){const t=i.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Yd(i,t,e,n){const s=i.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=Hd(e),h=kd(e),u=Wd(e),p=Xd(e),d=qd(e),m=Fd(e),_=Nd(r),g=s.createProgram();let f,c,b=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(bi).join(`
`),f.length>0&&(f+=`
`),c=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(bi).join(`
`),c.length>0&&(c+=`
`)):(f=[Na(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+u:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(bi).join(`
`),c=[Na(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",e.envMap?"#define "+p:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==0?"#define TONE_MAPPING":"",e.toneMapping!==0?Ot.tonemapping_pars_fragment:"",e.toneMapping!==0?Ld("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ot.colorspace_pars_fragment,Dd("linearToOutputTexel",e.outputColorSpace),Ud(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(bi).join(`
`)),a=gr(a),a=La(a,e),a=Ua(a,e),o=gr(o),o=La(o,e),o=Ua(o,e),a=Fa(a),o=Fa(o),e.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,f=[m,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+f,c=["#define varying in",e.glslVersion===Kr?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Kr?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+c);const E=b+f+a,M=b+c+o,C=Ca(s,s.VERTEX_SHADER,E),A=Ca(s,s.FRAGMENT_SHADER,M);s.attachShader(g,C),s.attachShader(g,A),e.index0AttributeName!==void 0?s.bindAttribLocation(g,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(g,0,"position"),s.linkProgram(g);function R(w){if(i.debug.checkShaderErrors){const I=s.getProgramInfoLog(g).trim(),B=s.getShaderInfoLog(C).trim(),O=s.getShaderInfoLog(A).trim();let G=!0,W=!0;if(s.getProgramParameter(g,s.LINK_STATUS)===!1)if(G=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,g,C,A);else{const Z=Da(s,C,"vertex"),k=Da(s,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(g,s.VALIDATE_STATUS)+`

Material Name: `+w.name+`
Material Type: `+w.type+`

Program Info Log: `+I+`
`+Z+`
`+k)}else I!==""?console.warn("THREE.WebGLProgram: Program Info Log:",I):(B===""||O==="")&&(W=!1);W&&(w.diagnostics={runnable:G,programLog:I,vertexShader:{log:B,prefix:f},fragmentShader:{log:O,prefix:c}})}s.deleteShader(C),s.deleteShader(A),P=new _s(s,g),S=Id(s,g)}let P;this.getUniforms=function(){return P===void 0&&R(this),P};let S;this.getAttributes=function(){return S===void 0&&R(this),S};let x=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return x===!1&&(x=s.getProgramParameter(g,wd)),x},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(g),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Rd++,this.cacheKey=t,this.usedTimes=1,this.program=g,this.vertexShader=C,this.fragmentShader=A,this}let Kd=0;class jd{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Zd(t),e.set(t,n)),n}}class Zd{constructor(t){this.id=Kd++,this.code=t,this.usedTimes=0}}function $d(i,t,e,n,s,r,a){const o=new br,l=new jd,h=new Set,u=[],p=s.logarithmicDepthBuffer,d=s.vertexTextures;let m=s.precision;const _={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(S){return h.add(S),S===0?"uv":`uv${S}`}function f(S,x,w,I,B){const O=I.fog,G=B.geometry,W=S.isMeshStandardMaterial?I.environment:null,Z=(S.isMeshStandardMaterial?e:t).get(S.envMap||W),k=Z&&Z.mapping===306?Z.image.height:null,tt=_[S.type];S.precision!==null&&(m=s.getMaxPrecision(S.precision),m!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",m,"instead."));const lt=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,vt=lt!==void 0?lt.length:0;let Lt=0;G.morphAttributes.position!==void 0&&(Lt=1),G.morphAttributes.normal!==void 0&&(Lt=2),G.morphAttributes.color!==void 0&&(Lt=3);let Xt,q,Q,xt;if(tt){const $t=qe[tt];Xt=$t.vertexShader,q=$t.fragmentShader}else Xt=S.vertexShader,q=S.fragmentShader,l.update(S),Q=l.getVertexShaderID(S),xt=l.getFragmentShaderID(S);const it=i.getRenderTarget(),Tt=i.state.buffers.depth.getReversed(),Ct=B.isInstancedMesh===!0,Bt=B.isBatchedMesh===!0,te=!!S.map,Vt=!!S.matcap,re=!!Z,U=!!S.aoMap,Se=!!S.lightMap,Ht=!!S.bumpMap,Mt=!!S.normalMap,ct=!!S.displacementMap,Wt=!!S.emissiveMap,ut=!!S.metalnessMap,T=!!S.roughnessMap,v=S.anisotropy>0,z=S.clearcoat>0,K=S.dispersion>0,$=S.iridescence>0,Y=S.sheen>0,at=S.transmission>0,nt=v&&!!S.anisotropyMap,st=z&&!!S.clearcoatMap,At=z&&!!S.clearcoatNormalMap,J=z&&!!S.clearcoatRoughnessMap,_t=$&&!!S.iridescenceMap,wt=$&&!!S.iridescenceThicknessMap,Rt=Y&&!!S.sheenColorMap,mt=Y&&!!S.sheenRoughnessMap,kt=!!S.specularMap,Dt=!!S.specularColorMap,Yt=!!S.specularIntensityMap,D=at&&!!S.transmissionMap,rt=at&&!!S.thicknessMap,X=!!S.gradientMap,j=!!S.alphaMap,pt=S.alphaTest>0,dt=!!S.alphaHash,Ut=!!S.extensions;let ae=0;S.toneMapped&&(it===null||it.isXRRenderTarget===!0)&&(ae=i.toneMapping);const xe={shaderID:tt,shaderType:S.type,shaderName:S.name,vertexShader:Xt,fragmentShader:q,defines:S.defines,customVertexShaderID:Q,customFragmentShaderID:xt,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:m,batching:Bt,batchingColor:Bt&&B._colorsTexture!==null,instancing:Ct,instancingColor:Ct&&B.instanceColor!==null,instancingMorph:Ct&&B.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:it===null?i.outputColorSpace:it.isXRRenderTarget===!0?it.texture.colorSpace:ai,alphaToCoverage:!!S.alphaToCoverage,map:te,matcap:Vt,envMap:re,envMapMode:re&&Z.mapping,envMapCubeUVHeight:k,aoMap:U,lightMap:Se,bumpMap:Ht,normalMap:Mt,displacementMap:d&&ct,emissiveMap:Wt,normalMapObjectSpace:Mt&&S.normalMapType===1,normalMapTangentSpace:Mt&&S.normalMapType===0,metalnessMap:ut,roughnessMap:T,anisotropy:v,anisotropyMap:nt,clearcoat:z,clearcoatMap:st,clearcoatNormalMap:At,clearcoatRoughnessMap:J,dispersion:K,iridescence:$,iridescenceMap:_t,iridescenceThicknessMap:wt,sheen:Y,sheenColorMap:Rt,sheenRoughnessMap:mt,specularMap:kt,specularColorMap:Dt,specularIntensityMap:Yt,transmission:at,transmissionMap:D,thicknessMap:rt,gradientMap:X,opaque:S.transparent===!1&&S.blending===1&&S.alphaToCoverage===!1,alphaMap:j,alphaTest:pt,alphaHash:dt,combine:S.combine,mapUv:te&&g(S.map.channel),aoMapUv:U&&g(S.aoMap.channel),lightMapUv:Se&&g(S.lightMap.channel),bumpMapUv:Ht&&g(S.bumpMap.channel),normalMapUv:Mt&&g(S.normalMap.channel),displacementMapUv:ct&&g(S.displacementMap.channel),emissiveMapUv:Wt&&g(S.emissiveMap.channel),metalnessMapUv:ut&&g(S.metalnessMap.channel),roughnessMapUv:T&&g(S.roughnessMap.channel),anisotropyMapUv:nt&&g(S.anisotropyMap.channel),clearcoatMapUv:st&&g(S.clearcoatMap.channel),clearcoatNormalMapUv:At&&g(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:J&&g(S.clearcoatRoughnessMap.channel),iridescenceMapUv:_t&&g(S.iridescenceMap.channel),iridescenceThicknessMapUv:wt&&g(S.iridescenceThicknessMap.channel),sheenColorMapUv:Rt&&g(S.sheenColorMap.channel),sheenRoughnessMapUv:mt&&g(S.sheenRoughnessMap.channel),specularMapUv:kt&&g(S.specularMap.channel),specularColorMapUv:Dt&&g(S.specularColorMap.channel),specularIntensityMapUv:Yt&&g(S.specularIntensityMap.channel),transmissionMapUv:D&&g(S.transmissionMap.channel),thicknessMapUv:rt&&g(S.thicknessMap.channel),alphaMapUv:j&&g(S.alphaMap.channel),vertexTangents:!!G.attributes.tangent&&(Mt||v),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!G.attributes.uv&&(te||j),fog:!!O,useFog:S.fog===!0,fogExp2:!!O&&O.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:p,reverseDepthBuffer:Tt,skinning:B.isSkinnedMesh===!0,morphTargets:G.morphAttributes.position!==void 0,morphNormals:G.morphAttributes.normal!==void 0,morphColors:G.morphAttributes.color!==void 0,morphTargetsCount:vt,morphTextureStride:Lt,numDirLights:x.directional.length,numPointLights:x.point.length,numSpotLights:x.spot.length,numSpotLightMaps:x.spotLightMap.length,numRectAreaLights:x.rectArea.length,numHemiLights:x.hemi.length,numDirLightShadows:x.directionalShadowMap.length,numPointLightShadows:x.pointShadowMap.length,numSpotLightShadows:x.spotShadowMap.length,numSpotLightShadowsWithMaps:x.numSpotLightShadowsWithMaps,numLightProbes:x.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:S.dithering,shadowMapEnabled:i.shadowMap.enabled&&w.length>0,shadowMapType:i.shadowMap.type,toneMapping:ae,decodeVideoTexture:te&&S.map.isVideoTexture===!0&&qt.getTransfer(S.map.colorSpace)===Jt,decodeVideoTextureEmissive:Wt&&S.emissiveMap.isVideoTexture===!0&&qt.getTransfer(S.emissiveMap.colorSpace)===Jt,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===2,flipSided:S.side===1,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionClipCullDistance:Ut&&S.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ut&&S.extensions.multiDraw===!0||Bt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()};return xe.vertexUv1s=h.has(1),xe.vertexUv2s=h.has(2),xe.vertexUv3s=h.has(3),h.clear(),xe}function c(S){const x=[];if(S.shaderID?x.push(S.shaderID):(x.push(S.customVertexShaderID),x.push(S.customFragmentShaderID)),S.defines!==void 0)for(const w in S.defines)x.push(w),x.push(S.defines[w]);return S.isRawShaderMaterial===!1&&(b(x,S),E(x,S),x.push(i.outputColorSpace)),x.push(S.customProgramCacheKey),x.join()}function b(S,x){S.push(x.precision),S.push(x.outputColorSpace),S.push(x.envMapMode),S.push(x.envMapCubeUVHeight),S.push(x.mapUv),S.push(x.alphaMapUv),S.push(x.lightMapUv),S.push(x.aoMapUv),S.push(x.bumpMapUv),S.push(x.normalMapUv),S.push(x.displacementMapUv),S.push(x.emissiveMapUv),S.push(x.metalnessMapUv),S.push(x.roughnessMapUv),S.push(x.anisotropyMapUv),S.push(x.clearcoatMapUv),S.push(x.clearcoatNormalMapUv),S.push(x.clearcoatRoughnessMapUv),S.push(x.iridescenceMapUv),S.push(x.iridescenceThicknessMapUv),S.push(x.sheenColorMapUv),S.push(x.sheenRoughnessMapUv),S.push(x.specularMapUv),S.push(x.specularColorMapUv),S.push(x.specularIntensityMapUv),S.push(x.transmissionMapUv),S.push(x.thicknessMapUv),S.push(x.combine),S.push(x.fogExp2),S.push(x.sizeAttenuation),S.push(x.morphTargetsCount),S.push(x.morphAttributeCount),S.push(x.numDirLights),S.push(x.numPointLights),S.push(x.numSpotLights),S.push(x.numSpotLightMaps),S.push(x.numHemiLights),S.push(x.numRectAreaLights),S.push(x.numDirLightShadows),S.push(x.numPointLightShadows),S.push(x.numSpotLightShadows),S.push(x.numSpotLightShadowsWithMaps),S.push(x.numLightProbes),S.push(x.shadowMapType),S.push(x.toneMapping),S.push(x.numClippingPlanes),S.push(x.numClipIntersection),S.push(x.depthPacking)}function E(S,x){o.disableAll(),x.supportsVertexTextures&&o.enable(0),x.instancing&&o.enable(1),x.instancingColor&&o.enable(2),x.instancingMorph&&o.enable(3),x.matcap&&o.enable(4),x.envMap&&o.enable(5),x.normalMapObjectSpace&&o.enable(6),x.normalMapTangentSpace&&o.enable(7),x.clearcoat&&o.enable(8),x.iridescence&&o.enable(9),x.alphaTest&&o.enable(10),x.vertexColors&&o.enable(11),x.vertexAlphas&&o.enable(12),x.vertexUv1s&&o.enable(13),x.vertexUv2s&&o.enable(14),x.vertexUv3s&&o.enable(15),x.vertexTangents&&o.enable(16),x.anisotropy&&o.enable(17),x.alphaHash&&o.enable(18),x.batching&&o.enable(19),x.dispersion&&o.enable(20),x.batchingColor&&o.enable(21),S.push(o.mask),o.disableAll(),x.fog&&o.enable(0),x.useFog&&o.enable(1),x.flatShading&&o.enable(2),x.logarithmicDepthBuffer&&o.enable(3),x.reverseDepthBuffer&&o.enable(4),x.skinning&&o.enable(5),x.morphTargets&&o.enable(6),x.morphNormals&&o.enable(7),x.morphColors&&o.enable(8),x.premultipliedAlpha&&o.enable(9),x.shadowMapEnabled&&o.enable(10),x.doubleSided&&o.enable(11),x.flipSided&&o.enable(12),x.useDepthPacking&&o.enable(13),x.dithering&&o.enable(14),x.transmission&&o.enable(15),x.sheen&&o.enable(16),x.opaque&&o.enable(17),x.pointsUvs&&o.enable(18),x.decodeVideoTexture&&o.enable(19),x.decodeVideoTextureEmissive&&o.enable(20),x.alphaToCoverage&&o.enable(21),S.push(o.mask)}function M(S){const x=_[S.type];let w;if(x){const I=qe[x];w=Fl.clone(I.uniforms)}else w=S.uniforms;return w}function C(S,x){let w;for(let I=0,B=u.length;I<B;I++){const O=u[I];if(O.cacheKey===x){w=O,++w.usedTimes;break}}return w===void 0&&(w=new Yd(i,x,S,r),u.push(w)),w}function A(S){if(--S.usedTimes===0){const x=u.indexOf(S);u[x]=u[u.length-1],u.pop(),S.destroy()}}function R(S){l.remove(S)}function P(){l.dispose()}return{getParameters:f,getProgramCacheKey:c,getUniforms:M,acquireProgram:C,releaseProgram:A,releaseShaderCache:R,programs:u,dispose:P}}function Jd(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Qd(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function Ia(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Ba(){const i=[];let t=0;const e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(p,d,m,_,g,f){let c=i[t];return c===void 0?(c={id:p.id,object:p,geometry:d,material:m,groupOrder:_,renderOrder:p.renderOrder,z:g,group:f},i[t]=c):(c.id=p.id,c.object=p,c.geometry=d,c.material=m,c.groupOrder=_,c.renderOrder=p.renderOrder,c.z=g,c.group=f),t++,c}function o(p,d,m,_,g,f){const c=a(p,d,m,_,g,f);m.transmission>0?n.push(c):m.transparent===!0?s.push(c):e.push(c)}function l(p,d,m,_,g,f){const c=a(p,d,m,_,g,f);m.transmission>0?n.unshift(c):m.transparent===!0?s.unshift(c):e.unshift(c)}function h(p,d){e.length>1&&e.sort(p||Qd),n.length>1&&n.sort(d||Ia),s.length>1&&s.sort(d||Ia)}function u(){for(let p=t,d=i.length;p<d;p++){const m=i[p];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:u,sort:h}}function tf(){let i=new WeakMap;function t(n,s){const r=i.get(n);let a;return r===void 0?(a=new Ba,i.set(n,[a])):s>=r.length?(a=new Ba,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function ef(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new N,color:new gt};break;case"SpotLight":e={position:new N,direction:new N,color:new gt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new N,color:new gt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new N,skyColor:new gt,groundColor:new gt};break;case"RectAreaLight":e={color:new gt,position:new N,halfWidth:new N,halfHeight:new N};break}return i[t.id]=e,e}}}function nf(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new It};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new It};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new It,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}let sf=0;function rf(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function af(i){const t=new ef,e=nf(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let h=0;h<9;h++)n.probe.push(new N);const s=new N,r=new ne,a=new ne;function o(h){let u=0,p=0,d=0;for(let S=0;S<9;S++)n.probe[S].set(0,0,0);let m=0,_=0,g=0,f=0,c=0,b=0,E=0,M=0,C=0,A=0,R=0;h.sort(rf);for(let S=0,x=h.length;S<x;S++){const w=h[S],I=w.color,B=w.intensity,O=w.distance,G=w.shadow&&w.shadow.map?w.shadow.map.texture:null;if(w.isAmbientLight)u+=I.r*B,p+=I.g*B,d+=I.b*B;else if(w.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(w.sh.coefficients[W],B);R++}else if(w.isDirectionalLight){const W=t.get(w);if(W.color.copy(w.color).multiplyScalar(w.intensity),w.castShadow){const Z=w.shadow,k=e.get(w);k.shadowIntensity=Z.intensity,k.shadowBias=Z.bias,k.shadowNormalBias=Z.normalBias,k.shadowRadius=Z.radius,k.shadowMapSize=Z.mapSize,n.directionalShadow[m]=k,n.directionalShadowMap[m]=G,n.directionalShadowMatrix[m]=w.shadow.matrix,b++}n.directional[m]=W,m++}else if(w.isSpotLight){const W=t.get(w);W.position.setFromMatrixPosition(w.matrixWorld),W.color.copy(I).multiplyScalar(B),W.distance=O,W.coneCos=Math.cos(w.angle),W.penumbraCos=Math.cos(w.angle*(1-w.penumbra)),W.decay=w.decay,n.spot[g]=W;const Z=w.shadow;if(w.map&&(n.spotLightMap[C]=w.map,C++,Z.updateMatrices(w),w.castShadow&&A++),n.spotLightMatrix[g]=Z.matrix,w.castShadow){const k=e.get(w);k.shadowIntensity=Z.intensity,k.shadowBias=Z.bias,k.shadowNormalBias=Z.normalBias,k.shadowRadius=Z.radius,k.shadowMapSize=Z.mapSize,n.spotShadow[g]=k,n.spotShadowMap[g]=G,M++}g++}else if(w.isRectAreaLight){const W=t.get(w);W.color.copy(I).multiplyScalar(B),W.halfWidth.set(w.width*.5,0,0),W.halfHeight.set(0,w.height*.5,0),n.rectArea[f]=W,f++}else if(w.isPointLight){const W=t.get(w);if(W.color.copy(w.color).multiplyScalar(w.intensity),W.distance=w.distance,W.decay=w.decay,w.castShadow){const Z=w.shadow,k=e.get(w);k.shadowIntensity=Z.intensity,k.shadowBias=Z.bias,k.shadowNormalBias=Z.normalBias,k.shadowRadius=Z.radius,k.shadowMapSize=Z.mapSize,k.shadowCameraNear=Z.camera.near,k.shadowCameraFar=Z.camera.far,n.pointShadow[_]=k,n.pointShadowMap[_]=G,n.pointShadowMatrix[_]=w.shadow.matrix,E++}n.point[_]=W,_++}else if(w.isHemisphereLight){const W=t.get(w);W.skyColor.copy(w.color).multiplyScalar(B),W.groundColor.copy(w.groundColor).multiplyScalar(B),n.hemi[c]=W,c++}}f>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ot.LTC_FLOAT_1,n.rectAreaLTC2=ot.LTC_FLOAT_2):(n.rectAreaLTC1=ot.LTC_HALF_1,n.rectAreaLTC2=ot.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=p,n.ambient[2]=d;const P=n.hash;(P.directionalLength!==m||P.pointLength!==_||P.spotLength!==g||P.rectAreaLength!==f||P.hemiLength!==c||P.numDirectionalShadows!==b||P.numPointShadows!==E||P.numSpotShadows!==M||P.numSpotMaps!==C||P.numLightProbes!==R)&&(n.directional.length=m,n.spot.length=g,n.rectArea.length=f,n.point.length=_,n.hemi.length=c,n.directionalShadow.length=b,n.directionalShadowMap.length=b,n.pointShadow.length=E,n.pointShadowMap.length=E,n.spotShadow.length=M,n.spotShadowMap.length=M,n.directionalShadowMatrix.length=b,n.pointShadowMatrix.length=E,n.spotLightMatrix.length=M+C-A,n.spotLightMap.length=C,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=R,P.directionalLength=m,P.pointLength=_,P.spotLength=g,P.rectAreaLength=f,P.hemiLength=c,P.numDirectionalShadows=b,P.numPointShadows=E,P.numSpotShadows=M,P.numSpotMaps=C,P.numLightProbes=R,n.version=sf++)}function l(h,u){let p=0,d=0,m=0,_=0,g=0;const f=u.matrixWorldInverse;for(let c=0,b=h.length;c<b;c++){const E=h[c];if(E.isDirectionalLight){const M=n.directional[p];M.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(f),p++}else if(E.isSpotLight){const M=n.spot[m];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(f),M.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(f),m++}else if(E.isRectAreaLight){const M=n.rectArea[_];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(f),a.identity(),r.copy(E.matrixWorld),r.premultiply(f),a.extractRotation(r),M.halfWidth.set(E.width*.5,0,0),M.halfHeight.set(0,E.height*.5,0),M.halfWidth.applyMatrix4(a),M.halfHeight.applyMatrix4(a),_++}else if(E.isPointLight){const M=n.point[d];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(f),d++}else if(E.isHemisphereLight){const M=n.hemi[g];M.direction.setFromMatrixPosition(E.matrixWorld),M.direction.transformDirection(f),g++}}}return{setup:o,setupView:l,state:n}}function Oa(i){const t=new af(i),e=[],n=[];function s(u){h.camera=u,e.length=0,n.length=0}function r(u){e.push(u)}function a(u){n.push(u)}function o(){t.setup(e)}function l(u){t.setupView(e,u)}const h={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:h,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function of(i){let t=new WeakMap;function e(s,r=0){const a=t.get(s);let o;return a===void 0?(o=new Oa(i),t.set(s,[o])):r>=a.length?(o=new Oa(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}class lf extends Sn{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class cf extends Sn{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const hf=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,uf=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function df(i,t,e){let n=new Tr;const s=new It,r=new It,a=new oe,o=new lf({depthPacking:3201}),l=new cf,h={},u=e.maxTextureSize,p={0:1,1:0,2:2},d=new ln({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new It},radius:{value:4}},vertexShader:hf,fragmentShader:uf}),m=d.clone();m.defines.HORIZONTAL_PASS=1;const _=new he;_.setAttribute("position",new ce(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const g=new le(_,d),f=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let c=this.type;this.render=function(A,R,P){if(f.enabled===!1||f.autoUpdate===!1&&f.needsUpdate===!1||A.length===0)return;const S=i.getRenderTarget(),x=i.getActiveCubeFace(),w=i.getActiveMipmapLevel(),I=i.state;I.setBlending(0),I.buffers.color.setClear(1,1,1,1),I.buffers.depth.setTest(!0),I.setScissorTest(!1);const B=c!==3&&this.type===3,O=c===3&&this.type!==3;for(let G=0,W=A.length;G<W;G++){const Z=A[G],k=Z.shadow;if(k===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;s.copy(k.mapSize);const tt=k.getFrameExtents();if(s.multiply(tt),r.copy(k.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/tt.x),s.x=r.x*tt.x,k.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/tt.y),s.y=r.y*tt.y,k.mapSize.y=r.y)),k.map===null||B===!0||O===!0){const vt=this.type!==3?{minFilter:1003,magFilter:1003}:{};k.map!==null&&k.map.dispose(),k.map=new Nn(s.x,s.y,vt),k.map.texture.name=Z.name+".shadowMap",k.camera.updateProjectionMatrix()}i.setRenderTarget(k.map),i.clear();const lt=k.getViewportCount();for(let vt=0;vt<lt;vt++){const Lt=k.getViewport(vt);a.set(r.x*Lt.x,r.y*Lt.y,r.x*Lt.z,r.y*Lt.w),I.viewport(a),k.updateMatrices(Z,vt),n=k.getFrustum(),M(R,P,k.camera,Z,this.type)}k.isPointLightShadow!==!0&&this.type===3&&b(k,P),k.needsUpdate=!1}c=this.type,f.needsUpdate=!1,i.setRenderTarget(S,x,w)};function b(A,R){const P=t.update(g);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,m.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,m.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Nn(s.x,s.y)),d.uniforms.shadow_pass.value=A.map.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,i.setRenderTarget(A.mapPass),i.clear(),i.renderBufferDirect(R,null,P,d,g,null),m.uniforms.shadow_pass.value=A.mapPass.texture,m.uniforms.resolution.value=A.mapSize,m.uniforms.radius.value=A.radius,i.setRenderTarget(A.map),i.clear(),i.renderBufferDirect(R,null,P,m,g,null)}function E(A,R,P,S){let x=null;const w=P.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(w!==void 0)x=w;else if(x=P.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0){const I=x.uuid,B=R.uuid;let O=h[I];O===void 0&&(O={},h[I]=O);let G=O[B];G===void 0&&(G=x.clone(),O[B]=G,R.addEventListener("dispose",C)),x=G}if(x.visible=R.visible,x.wireframe=R.wireframe,S===3?x.side=R.shadowSide!==null?R.shadowSide:R.side:x.side=R.shadowSide!==null?R.shadowSide:p[R.side],x.alphaMap=R.alphaMap,x.alphaTest=R.alphaTest,x.map=R.map,x.clipShadows=R.clipShadows,x.clippingPlanes=R.clippingPlanes,x.clipIntersection=R.clipIntersection,x.displacementMap=R.displacementMap,x.displacementScale=R.displacementScale,x.displacementBias=R.displacementBias,x.wireframeLinewidth=R.wireframeLinewidth,x.linewidth=R.linewidth,P.isPointLight===!0&&x.isMeshDistanceMaterial===!0){const I=i.properties.get(x);I.light=P}return x}function M(A,R,P,S,x){if(A.visible===!1)return;if(A.layers.test(R.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&x===3)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,A.matrixWorld);const B=t.update(A),O=A.material;if(Array.isArray(O)){const G=B.groups;for(let W=0,Z=G.length;W<Z;W++){const k=G[W],tt=O[k.materialIndex];if(tt&&tt.visible){const lt=E(A,tt,S,x);A.onBeforeShadow(i,A,R,P,B,lt,k),i.renderBufferDirect(P,null,B,lt,A,k),A.onAfterShadow(i,A,R,P,B,lt,k)}}}else if(O.visible){const G=E(A,O,S,x);A.onBeforeShadow(i,A,R,P,B,G,null),i.renderBufferDirect(P,null,B,G,A,null),A.onAfterShadow(i,A,R,P,B,G,null)}}const I=A.children;for(let B=0,O=I.length;B<O;B++)M(I[B],R,P,S,x)}function C(A){A.target.removeEventListener("dispose",C);for(const P in h){const S=h[P],x=A.target.uuid;x in S&&(S[x].dispose(),delete S[x])}}}const ff={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3};function pf(i,t){function e(){let D=!1;const rt=new oe;let X=null;const j=new oe(0,0,0,0);return{setMask:function(pt){X!==pt&&!D&&(i.colorMask(pt,pt,pt,pt),X=pt)},setLocked:function(pt){D=pt},setClear:function(pt,dt,Ut,ae,xe){xe===!0&&(pt*=ae,dt*=ae,Ut*=ae),rt.set(pt,dt,Ut,ae),j.equals(rt)===!1&&(i.clearColor(pt,dt,Ut,ae),j.copy(rt))},reset:function(){D=!1,X=null,j.set(-1,0,0,0)}}}function n(){let D=!1,rt=!1,X=null,j=null,pt=null;return{setReversed:function(dt){if(rt!==dt){const Ut=t.get("EXT_clip_control");rt?Ut.clipControlEXT(Ut.LOWER_LEFT_EXT,Ut.ZERO_TO_ONE_EXT):Ut.clipControlEXT(Ut.LOWER_LEFT_EXT,Ut.NEGATIVE_ONE_TO_ONE_EXT);const ae=pt;pt=null,this.setClear(ae)}rt=dt},getReversed:function(){return rt},setTest:function(dt){dt?it(i.DEPTH_TEST):Tt(i.DEPTH_TEST)},setMask:function(dt){X!==dt&&!D&&(i.depthMask(dt),X=dt)},setFunc:function(dt){if(rt&&(dt=ff[dt]),j!==dt){switch(dt){case 0:i.depthFunc(i.NEVER);break;case 1:i.depthFunc(i.ALWAYS);break;case 2:i.depthFunc(i.LESS);break;case 3:i.depthFunc(i.LEQUAL);break;case 4:i.depthFunc(i.EQUAL);break;case 5:i.depthFunc(i.GEQUAL);break;case 6:i.depthFunc(i.GREATER);break;case 7:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}j=dt}},setLocked:function(dt){D=dt},setClear:function(dt){pt!==dt&&(rt&&(dt=1-dt),i.clearDepth(dt),pt=dt)},reset:function(){D=!1,X=null,j=null,pt=null,rt=!1}}}function s(){let D=!1,rt=null,X=null,j=null,pt=null,dt=null,Ut=null,ae=null,xe=null;return{setTest:function($t){D||($t?it(i.STENCIL_TEST):Tt(i.STENCIL_TEST))},setMask:function($t){rt!==$t&&!D&&(i.stencilMask($t),rt=$t)},setFunc:function($t,Oe,$e){(X!==$t||j!==Oe||pt!==$e)&&(i.stencilFunc($t,Oe,$e),X=$t,j=Oe,pt=$e)},setOp:function($t,Oe,$e){(dt!==$t||Ut!==Oe||ae!==$e)&&(i.stencilOp($t,Oe,$e),dt=$t,Ut=Oe,ae=$e)},setLocked:function($t){D=$t},setClear:function($t){xe!==$t&&(i.clearStencil($t),xe=$t)},reset:function(){D=!1,rt=null,X=null,j=null,pt=null,dt=null,Ut=null,ae=null,xe=null}}}const r=new e,a=new n,o=new s,l=new WeakMap,h=new WeakMap;let u={},p={},d=new WeakMap,m=[],_=null,g=!1,f=null,c=null,b=null,E=null,M=null,C=null,A=null,R=new gt(0,0,0),P=0,S=!1,x=null,w=null,I=null,B=null,O=null;const G=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,Z=0;const k=i.getParameter(i.VERSION);k.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(k)[1]),W=Z>=1):k.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(k)[1]),W=Z>=2);let tt=null,lt={};const vt=i.getParameter(i.SCISSOR_BOX),Lt=i.getParameter(i.VIEWPORT),Xt=new oe().fromArray(vt),q=new oe().fromArray(Lt);function Q(D,rt,X,j){const pt=new Uint8Array(4),dt=i.createTexture();i.bindTexture(D,dt),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ut=0;Ut<X;Ut++)D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY?i.texImage3D(rt,0,i.RGBA,1,1,j,0,i.RGBA,i.UNSIGNED_BYTE,pt):i.texImage2D(rt+Ut,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,pt);return dt}const xt={};xt[i.TEXTURE_2D]=Q(i.TEXTURE_2D,i.TEXTURE_2D,1),xt[i.TEXTURE_CUBE_MAP]=Q(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),xt[i.TEXTURE_2D_ARRAY]=Q(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),xt[i.TEXTURE_3D]=Q(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),it(i.DEPTH_TEST),a.setFunc(3),Ht(!1),Mt(1),it(i.CULL_FACE),U(0);function it(D){u[D]!==!0&&(i.enable(D),u[D]=!0)}function Tt(D){u[D]!==!1&&(i.disable(D),u[D]=!1)}function Ct(D,rt){return p[D]!==rt?(i.bindFramebuffer(D,rt),p[D]=rt,D===i.DRAW_FRAMEBUFFER&&(p[i.FRAMEBUFFER]=rt),D===i.FRAMEBUFFER&&(p[i.DRAW_FRAMEBUFFER]=rt),!0):!1}function Bt(D,rt){let X=m,j=!1;if(D){X=d.get(rt),X===void 0&&(X=[],d.set(rt,X));const pt=D.textures;if(X.length!==pt.length||X[0]!==i.COLOR_ATTACHMENT0){for(let dt=0,Ut=pt.length;dt<Ut;dt++)X[dt]=i.COLOR_ATTACHMENT0+dt;X.length=pt.length,j=!0}}else X[0]!==i.BACK&&(X[0]=i.BACK,j=!0);j&&i.drawBuffers(X)}function te(D){return _!==D?(i.useProgram(D),_=D,!0):!1}const Vt={100:i.FUNC_ADD,101:i.FUNC_SUBTRACT,102:i.FUNC_REVERSE_SUBTRACT};Vt[103]=i.MIN,Vt[104]=i.MAX;const re={200:i.ZERO,201:i.ONE,202:i.SRC_COLOR,204:i.SRC_ALPHA,210:i.SRC_ALPHA_SATURATE,208:i.DST_COLOR,206:i.DST_ALPHA,203:i.ONE_MINUS_SRC_COLOR,205:i.ONE_MINUS_SRC_ALPHA,209:i.ONE_MINUS_DST_COLOR,207:i.ONE_MINUS_DST_ALPHA,211:i.CONSTANT_COLOR,212:i.ONE_MINUS_CONSTANT_COLOR,213:i.CONSTANT_ALPHA,214:i.ONE_MINUS_CONSTANT_ALPHA};function U(D,rt,X,j,pt,dt,Ut,ae,xe,$t){if(D===0){g===!0&&(Tt(i.BLEND),g=!1);return}if(g===!1&&(it(i.BLEND),g=!0),D!==5){if(D!==f||$t!==S){if((c!==100||M!==100)&&(i.blendEquation(i.FUNC_ADD),c=100,M=100),$t)switch(D){case 1:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case 2:i.blendFunc(i.ONE,i.ONE);break;case 3:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case 4:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case 1:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case 2:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case 3:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case 4:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}b=null,E=null,C=null,A=null,R.set(0,0,0),P=0,f=D,S=$t}return}pt=pt||rt,dt=dt||X,Ut=Ut||j,(rt!==c||pt!==M)&&(i.blendEquationSeparate(Vt[rt],Vt[pt]),c=rt,M=pt),(X!==b||j!==E||dt!==C||Ut!==A)&&(i.blendFuncSeparate(re[X],re[j],re[dt],re[Ut]),b=X,E=j,C=dt,A=Ut),(ae.equals(R)===!1||xe!==P)&&(i.blendColor(ae.r,ae.g,ae.b,xe),R.copy(ae),P=xe),f=D,S=!1}function Se(D,rt){D.side===2?Tt(i.CULL_FACE):it(i.CULL_FACE);let X=D.side===1;rt&&(X=!X),Ht(X),D.blending===1&&D.transparent===!1?U(0):U(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),a.setFunc(D.depthFunc),a.setTest(D.depthTest),a.setMask(D.depthWrite),r.setMask(D.colorWrite);const j=D.stencilWrite;o.setTest(j),j&&(o.setMask(D.stencilWriteMask),o.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),o.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),Wt(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?it(i.SAMPLE_ALPHA_TO_COVERAGE):Tt(i.SAMPLE_ALPHA_TO_COVERAGE)}function Ht(D){x!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),x=D)}function Mt(D){D!==0?(it(i.CULL_FACE),D!==w&&(D===1?i.cullFace(i.BACK):D===2?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Tt(i.CULL_FACE),w=D}function ct(D){D!==I&&(W&&i.lineWidth(D),I=D)}function Wt(D,rt,X){D?(it(i.POLYGON_OFFSET_FILL),(B!==rt||O!==X)&&(i.polygonOffset(rt,X),B=rt,O=X)):Tt(i.POLYGON_OFFSET_FILL)}function ut(D){D?it(i.SCISSOR_TEST):Tt(i.SCISSOR_TEST)}function T(D){D===void 0&&(D=i.TEXTURE0+G-1),tt!==D&&(i.activeTexture(D),tt=D)}function v(D,rt,X){X===void 0&&(tt===null?X=i.TEXTURE0+G-1:X=tt);let j=lt[X];j===void 0&&(j={type:void 0,texture:void 0},lt[X]=j),(j.type!==D||j.texture!==rt)&&(tt!==X&&(i.activeTexture(X),tt=X),i.bindTexture(D,rt||xt[D]),j.type=D,j.texture=rt)}function z(){const D=lt[tt];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function K(){try{i.compressedTexImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function $(){try{i.compressedTexImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Y(){try{i.texSubImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function at(){try{i.texSubImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function nt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function st(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function At(){try{i.texStorage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function J(){try{i.texStorage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function _t(){try{i.texImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function wt(){try{i.texImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Rt(D){Xt.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),Xt.copy(D))}function mt(D){q.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),q.copy(D))}function kt(D,rt){let X=h.get(rt);X===void 0&&(X=new WeakMap,h.set(rt,X));let j=X.get(D);j===void 0&&(j=i.getUniformBlockIndex(rt,D.name),X.set(D,j))}function Dt(D,rt){const j=h.get(rt).get(D);l.get(rt)!==j&&(i.uniformBlockBinding(rt,j,D.__bindingPointIndex),l.set(rt,j))}function Yt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),u={},tt=null,lt={},p={},d=new WeakMap,m=[],_=null,g=!1,f=null,c=null,b=null,E=null,M=null,C=null,A=null,R=new gt(0,0,0),P=0,S=!1,x=null,w=null,I=null,B=null,O=null,Xt.set(0,0,i.canvas.width,i.canvas.height),q.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:it,disable:Tt,bindFramebuffer:Ct,drawBuffers:Bt,useProgram:te,setBlending:U,setMaterial:Se,setFlipSided:Ht,setCullFace:Mt,setLineWidth:ct,setPolygonOffset:Wt,setScissorTest:ut,activeTexture:T,bindTexture:v,unbindTexture:z,compressedTexImage2D:K,compressedTexImage3D:$,texImage2D:_t,texImage3D:wt,updateUBOMapping:kt,uniformBlockBinding:Dt,texStorage2D:At,texStorage3D:J,texSubImage2D:Y,texSubImage3D:at,compressedTexSubImage2D:nt,compressedTexSubImage3D:st,scissor:Rt,viewport:mt,reset:Yt}}function za(i,t,e,n){const s=mf(n);switch(e){case 1021:return i*t;case 1024:return i*t;case 1025:return i*t*2;case 1028:return i*t/s.components*s.byteLength;case 1029:return i*t/s.components*s.byteLength;case 1030:return i*t*2/s.components*s.byteLength;case 1031:return i*t*2/s.components*s.byteLength;case 1022:return i*t*3/s.components*s.byteLength;case 1023:return i*t*4/s.components*s.byteLength;case 1033:return i*t*4/s.components*s.byteLength;case 33776:case 33777:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case 33778:case 33779:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case 35841:case 35843:return Math.max(i,16)*Math.max(t,8)/4;case 35840:case 35842:return Math.max(i,8)*Math.max(t,8)/2;case 36196:case 37492:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case 37496:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case 37808:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case 37809:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case 37810:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case 37811:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case 37812:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case 37813:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case 37814:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case 37815:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case 37816:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case 37817:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case 37818:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case 37819:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case 37820:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case 37821:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(i/4)*Math.ceil(t/4)*16;case 36283:case 36284:return Math.ceil(i/4)*Math.ceil(t/4)*8;case 36285:case 36286:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function mf(i){switch(i){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function gf(i,t,e,n,s,r,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),h=new It,u=new WeakMap;let p;const d=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(T,v){return m?new OffscreenCanvas(T,v):wi("canvas")}function g(T,v,z){let K=1;const $=ut(T);if(($.width>z||$.height>z)&&(K=z/Math.max($.width,$.height)),K<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){const Y=Math.floor(K*$.width),at=Math.floor(K*$.height);p===void 0&&(p=_(Y,at));const nt=v?_(Y,at):p;return nt.width=Y,nt.height=at,nt.getContext("2d").drawImage(T,0,0,Y,at),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+$.width+"x"+$.height+") to ("+Y+"x"+at+")."),nt}else return"data"in T&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+$.width+"x"+$.height+")."),T;return T}function f(T){return T.generateMipmaps}function c(T){i.generateMipmap(T)}function b(T){return T.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?i.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function E(T,v,z,K,$=!1){if(T!==null){if(i[T]!==void 0)return i[T];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let Y=v;if(v===i.RED&&(z===i.FLOAT&&(Y=i.R32F),z===i.HALF_FLOAT&&(Y=i.R16F),z===i.UNSIGNED_BYTE&&(Y=i.R8)),v===i.RED_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.R8UI),z===i.UNSIGNED_SHORT&&(Y=i.R16UI),z===i.UNSIGNED_INT&&(Y=i.R32UI),z===i.BYTE&&(Y=i.R8I),z===i.SHORT&&(Y=i.R16I),z===i.INT&&(Y=i.R32I)),v===i.RG&&(z===i.FLOAT&&(Y=i.RG32F),z===i.HALF_FLOAT&&(Y=i.RG16F),z===i.UNSIGNED_BYTE&&(Y=i.RG8)),v===i.RG_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.RG8UI),z===i.UNSIGNED_SHORT&&(Y=i.RG16UI),z===i.UNSIGNED_INT&&(Y=i.RG32UI),z===i.BYTE&&(Y=i.RG8I),z===i.SHORT&&(Y=i.RG16I),z===i.INT&&(Y=i.RG32I)),v===i.RGB_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.RGB8UI),z===i.UNSIGNED_SHORT&&(Y=i.RGB16UI),z===i.UNSIGNED_INT&&(Y=i.RGB32UI),z===i.BYTE&&(Y=i.RGB8I),z===i.SHORT&&(Y=i.RGB16I),z===i.INT&&(Y=i.RGB32I)),v===i.RGBA_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.RGBA8UI),z===i.UNSIGNED_SHORT&&(Y=i.RGBA16UI),z===i.UNSIGNED_INT&&(Y=i.RGBA32UI),z===i.BYTE&&(Y=i.RGBA8I),z===i.SHORT&&(Y=i.RGBA16I),z===i.INT&&(Y=i.RGBA32I)),v===i.RGB&&z===i.UNSIGNED_INT_5_9_9_9_REV&&(Y=i.RGB9_E5),v===i.RGBA){const at=$?Ts:qt.getTransfer(K);z===i.FLOAT&&(Y=i.RGBA32F),z===i.HALF_FLOAT&&(Y=i.RGBA16F),z===i.UNSIGNED_BYTE&&(Y=at===Jt?i.SRGB8_ALPHA8:i.RGBA8),z===i.UNSIGNED_SHORT_4_4_4_4&&(Y=i.RGBA4),z===i.UNSIGNED_SHORT_5_5_5_1&&(Y=i.RGB5_A1)}return(Y===i.R16F||Y===i.R32F||Y===i.RG16F||Y===i.RG32F||Y===i.RGBA16F||Y===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function M(T,v){let z;return T?v===null||v===1014||v===1020?z=i.DEPTH24_STENCIL8:v===1015?z=i.DEPTH32F_STENCIL8:v===1012&&(z=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===1014||v===1020?z=i.DEPTH_COMPONENT24:v===1015?z=i.DEPTH_COMPONENT32F:v===1012&&(z=i.DEPTH_COMPONENT16),z}function C(T,v){return f(T)===!0||T.isFramebufferTexture&&T.minFilter!==1003&&T.minFilter!==1006?Math.log2(Math.max(v.width,v.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?v.mipmaps.length:1}function A(T){const v=T.target;v.removeEventListener("dispose",A),P(v),v.isVideoTexture&&u.delete(v)}function R(T){const v=T.target;v.removeEventListener("dispose",R),x(v)}function P(T){const v=n.get(T);if(v.__webglInit===void 0)return;const z=T.source,K=d.get(z);if(K){const $=K[v.__cacheKey];$.usedTimes--,$.usedTimes===0&&S(T),Object.keys(K).length===0&&d.delete(z)}n.remove(T)}function S(T){const v=n.get(T);i.deleteTexture(v.__webglTexture);const z=T.source,K=d.get(z);delete K[v.__cacheKey],a.memory.textures--}function x(T){const v=n.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),n.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(v.__webglFramebuffer[K]))for(let $=0;$<v.__webglFramebuffer[K].length;$++)i.deleteFramebuffer(v.__webglFramebuffer[K][$]);else i.deleteFramebuffer(v.__webglFramebuffer[K]);v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer[K])}else{if(Array.isArray(v.__webglFramebuffer))for(let K=0;K<v.__webglFramebuffer.length;K++)i.deleteFramebuffer(v.__webglFramebuffer[K]);else i.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&i.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let K=0;K<v.__webglColorRenderbuffer.length;K++)v.__webglColorRenderbuffer[K]&&i.deleteRenderbuffer(v.__webglColorRenderbuffer[K]);v.__webglDepthRenderbuffer&&i.deleteRenderbuffer(v.__webglDepthRenderbuffer)}const z=T.textures;for(let K=0,$=z.length;K<$;K++){const Y=n.get(z[K]);Y.__webglTexture&&(i.deleteTexture(Y.__webglTexture),a.memory.textures--),n.remove(z[K])}n.remove(T)}let w=0;function I(){w=0}function B(){const T=w;return T>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+s.maxTextures),w+=1,T}function O(T){const v=[];return v.push(T.wrapS),v.push(T.wrapT),v.push(T.wrapR||0),v.push(T.magFilter),v.push(T.minFilter),v.push(T.anisotropy),v.push(T.internalFormat),v.push(T.format),v.push(T.type),v.push(T.generateMipmaps),v.push(T.premultiplyAlpha),v.push(T.flipY),v.push(T.unpackAlignment),v.push(T.colorSpace),v.join()}function G(T,v){const z=n.get(T);if(T.isVideoTexture&&ct(T),T.isRenderTargetTexture===!1&&T.version>0&&z.__version!==T.version){const K=T.image;if(K===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{q(z,T,v);return}}e.bindTexture(i.TEXTURE_2D,z.__webglTexture,i.TEXTURE0+v)}function W(T,v){const z=n.get(T);if(T.version>0&&z.__version!==T.version){q(z,T,v);return}e.bindTexture(i.TEXTURE_2D_ARRAY,z.__webglTexture,i.TEXTURE0+v)}function Z(T,v){const z=n.get(T);if(T.version>0&&z.__version!==T.version){q(z,T,v);return}e.bindTexture(i.TEXTURE_3D,z.__webglTexture,i.TEXTURE0+v)}function k(T,v){const z=n.get(T);if(T.version>0&&z.__version!==T.version){Q(z,T,v);return}e.bindTexture(i.TEXTURE_CUBE_MAP,z.__webglTexture,i.TEXTURE0+v)}const tt={1e3:i.REPEAT,1001:i.CLAMP_TO_EDGE,1002:i.MIRRORED_REPEAT},lt={1003:i.NEAREST,1004:i.NEAREST_MIPMAP_NEAREST,1005:i.NEAREST_MIPMAP_LINEAR,1006:i.LINEAR,1007:i.LINEAR_MIPMAP_NEAREST,1008:i.LINEAR_MIPMAP_LINEAR},vt={512:i.NEVER,519:i.ALWAYS,513:i.LESS,515:i.LEQUAL,514:i.EQUAL,518:i.GEQUAL,516:i.GREATER,517:i.NOTEQUAL};function Lt(T,v){if(v.type===1015&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===1006||v.magFilter===1007||v.magFilter===1005||v.magFilter===1008||v.minFilter===1006||v.minFilter===1007||v.minFilter===1005||v.minFilter===1008)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(T,i.TEXTURE_WRAP_S,tt[v.wrapS]),i.texParameteri(T,i.TEXTURE_WRAP_T,tt[v.wrapT]),(T===i.TEXTURE_3D||T===i.TEXTURE_2D_ARRAY)&&i.texParameteri(T,i.TEXTURE_WRAP_R,tt[v.wrapR]),i.texParameteri(T,i.TEXTURE_MAG_FILTER,lt[v.magFilter]),i.texParameteri(T,i.TEXTURE_MIN_FILTER,lt[v.minFilter]),v.compareFunction&&(i.texParameteri(T,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(T,i.TEXTURE_COMPARE_FUNC,vt[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===1003||v.minFilter!==1005&&v.minFilter!==1008||v.type===1015&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){const z=t.get("EXT_texture_filter_anisotropic");i.texParameterf(T,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,s.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Xt(T,v){let z=!1;T.__webglInit===void 0&&(T.__webglInit=!0,v.addEventListener("dispose",A));const K=v.source;let $=d.get(K);$===void 0&&($={},d.set(K,$));const Y=O(v);if(Y!==T.__cacheKey){$[Y]===void 0&&($[Y]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,z=!0),$[Y].usedTimes++;const at=$[T.__cacheKey];at!==void 0&&($[T.__cacheKey].usedTimes--,at.usedTimes===0&&S(v)),T.__cacheKey=Y,T.__webglTexture=$[Y].texture}return z}function q(T,v,z){let K=i.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(K=i.TEXTURE_2D_ARRAY),v.isData3DTexture&&(K=i.TEXTURE_3D);const $=Xt(T,v),Y=v.source;e.bindTexture(K,T.__webglTexture,i.TEXTURE0+z);const at=n.get(Y);if(Y.version!==at.__version||$===!0){e.activeTexture(i.TEXTURE0+z);const nt=qt.getPrimaries(qt.workingColorSpace),st=v.colorSpace===""?null:qt.getPrimaries(v.colorSpace),At=v.colorSpace===""||nt===st?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,At);let J=g(v.image,!1,s.maxTextureSize);J=Wt(v,J);const _t=r.convert(v.format,v.colorSpace),wt=r.convert(v.type);let Rt=E(v.internalFormat,_t,wt,v.colorSpace,v.isVideoTexture);Lt(K,v);let mt;const kt=v.mipmaps,Dt=v.isVideoTexture!==!0,Yt=at.__version===void 0||$===!0,D=Y.dataReady,rt=C(v,J);if(v.isDepthTexture)Rt=M(v.format===1027,v.type),Yt&&(Dt?e.texStorage2D(i.TEXTURE_2D,1,Rt,J.width,J.height):e.texImage2D(i.TEXTURE_2D,0,Rt,J.width,J.height,0,_t,wt,null));else if(v.isDataTexture)if(kt.length>0){Dt&&Yt&&e.texStorage2D(i.TEXTURE_2D,rt,Rt,kt[0].width,kt[0].height);for(let X=0,j=kt.length;X<j;X++)mt=kt[X],Dt?D&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,mt.width,mt.height,_t,wt,mt.data):e.texImage2D(i.TEXTURE_2D,X,Rt,mt.width,mt.height,0,_t,wt,mt.data);v.generateMipmaps=!1}else Dt?(Yt&&e.texStorage2D(i.TEXTURE_2D,rt,Rt,J.width,J.height),D&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,J.width,J.height,_t,wt,J.data)):e.texImage2D(i.TEXTURE_2D,0,Rt,J.width,J.height,0,_t,wt,J.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Dt&&Yt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,rt,Rt,kt[0].width,kt[0].height,J.depth);for(let X=0,j=kt.length;X<j;X++)if(mt=kt[X],v.format!==1023)if(_t!==null)if(Dt){if(D)if(v.layerUpdates.size>0){const pt=za(mt.width,mt.height,v.format,v.type);for(const dt of v.layerUpdates){const Ut=mt.data.subarray(dt*pt/mt.data.BYTES_PER_ELEMENT,(dt+1)*pt/mt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,dt,mt.width,mt.height,1,_t,Ut)}v.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,0,mt.width,mt.height,J.depth,_t,mt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,X,Rt,mt.width,mt.height,J.depth,0,mt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Dt?D&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,0,mt.width,mt.height,J.depth,_t,wt,mt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,X,Rt,mt.width,mt.height,J.depth,0,_t,wt,mt.data)}else{Dt&&Yt&&e.texStorage2D(i.TEXTURE_2D,rt,Rt,kt[0].width,kt[0].height);for(let X=0,j=kt.length;X<j;X++)mt=kt[X],v.format!==1023?_t!==null?Dt?D&&e.compressedTexSubImage2D(i.TEXTURE_2D,X,0,0,mt.width,mt.height,_t,mt.data):e.compressedTexImage2D(i.TEXTURE_2D,X,Rt,mt.width,mt.height,0,mt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Dt?D&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,mt.width,mt.height,_t,wt,mt.data):e.texImage2D(i.TEXTURE_2D,X,Rt,mt.width,mt.height,0,_t,wt,mt.data)}else if(v.isDataArrayTexture)if(Dt){if(Yt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,rt,Rt,J.width,J.height,J.depth),D)if(v.layerUpdates.size>0){const X=za(J.width,J.height,v.format,v.type);for(const j of v.layerUpdates){const pt=J.data.subarray(j*X/J.data.BYTES_PER_ELEMENT,(j+1)*X/J.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,j,J.width,J.height,1,_t,wt,pt)}v.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,_t,wt,J.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,Rt,J.width,J.height,J.depth,0,_t,wt,J.data);else if(v.isData3DTexture)Dt?(Yt&&e.texStorage3D(i.TEXTURE_3D,rt,Rt,J.width,J.height,J.depth),D&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,_t,wt,J.data)):e.texImage3D(i.TEXTURE_3D,0,Rt,J.width,J.height,J.depth,0,_t,wt,J.data);else if(v.isFramebufferTexture){if(Yt)if(Dt)e.texStorage2D(i.TEXTURE_2D,rt,Rt,J.width,J.height);else{let X=J.width,j=J.height;for(let pt=0;pt<rt;pt++)e.texImage2D(i.TEXTURE_2D,pt,Rt,X,j,0,_t,wt,null),X>>=1,j>>=1}}else if(kt.length>0){if(Dt&&Yt){const X=ut(kt[0]);e.texStorage2D(i.TEXTURE_2D,rt,Rt,X.width,X.height)}for(let X=0,j=kt.length;X<j;X++)mt=kt[X],Dt?D&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,_t,wt,mt):e.texImage2D(i.TEXTURE_2D,X,Rt,_t,wt,mt);v.generateMipmaps=!1}else if(Dt){if(Yt){const X=ut(J);e.texStorage2D(i.TEXTURE_2D,rt,Rt,X.width,X.height)}D&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,_t,wt,J)}else e.texImage2D(i.TEXTURE_2D,0,Rt,_t,wt,J);f(v)&&c(K),at.__version=Y.version,v.onUpdate&&v.onUpdate(v)}T.__version=v.version}function Q(T,v,z){if(v.image.length!==6)return;const K=Xt(T,v),$=v.source;e.bindTexture(i.TEXTURE_CUBE_MAP,T.__webglTexture,i.TEXTURE0+z);const Y=n.get($);if($.version!==Y.__version||K===!0){e.activeTexture(i.TEXTURE0+z);const at=qt.getPrimaries(qt.workingColorSpace),nt=v.colorSpace===""?null:qt.getPrimaries(v.colorSpace),st=v.colorSpace===""||at===nt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,st);const At=v.isCompressedTexture||v.image[0].isCompressedTexture,J=v.image[0]&&v.image[0].isDataTexture,_t=[];for(let j=0;j<6;j++)!At&&!J?_t[j]=g(v.image[j],!0,s.maxCubemapSize):_t[j]=J?v.image[j].image:v.image[j],_t[j]=Wt(v,_t[j]);const wt=_t[0],Rt=r.convert(v.format,v.colorSpace),mt=r.convert(v.type),kt=E(v.internalFormat,Rt,mt,v.colorSpace),Dt=v.isVideoTexture!==!0,Yt=Y.__version===void 0||K===!0,D=$.dataReady;let rt=C(v,wt);Lt(i.TEXTURE_CUBE_MAP,v);let X;if(At){Dt&&Yt&&e.texStorage2D(i.TEXTURE_CUBE_MAP,rt,kt,wt.width,wt.height);for(let j=0;j<6;j++){X=_t[j].mipmaps;for(let pt=0;pt<X.length;pt++){const dt=X[pt];v.format!==1023?Rt!==null?Dt?D&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt,0,0,dt.width,dt.height,Rt,dt.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt,kt,dt.width,dt.height,0,dt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Dt?D&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt,0,0,dt.width,dt.height,Rt,mt,dt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt,kt,dt.width,dt.height,0,Rt,mt,dt.data)}}}else{if(X=v.mipmaps,Dt&&Yt){X.length>0&&rt++;const j=ut(_t[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,rt,kt,j.width,j.height)}for(let j=0;j<6;j++)if(J){Dt?D&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,_t[j].width,_t[j].height,Rt,mt,_t[j].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,kt,_t[j].width,_t[j].height,0,Rt,mt,_t[j].data);for(let pt=0;pt<X.length;pt++){const Ut=X[pt].image[j].image;Dt?D&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt+1,0,0,Ut.width,Ut.height,Rt,mt,Ut.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt+1,kt,Ut.width,Ut.height,0,Rt,mt,Ut.data)}}else{Dt?D&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Rt,mt,_t[j]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,kt,Rt,mt,_t[j]);for(let pt=0;pt<X.length;pt++){const dt=X[pt];Dt?D&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt+1,0,0,Rt,mt,dt.image[j]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,pt+1,kt,Rt,mt,dt.image[j])}}}f(v)&&c(i.TEXTURE_CUBE_MAP),Y.__version=$.version,v.onUpdate&&v.onUpdate(v)}T.__version=v.version}function xt(T,v,z,K,$,Y){const at=r.convert(z.format,z.colorSpace),nt=r.convert(z.type),st=E(z.internalFormat,at,nt,z.colorSpace),At=n.get(v),J=n.get(z);if(J.__renderTarget=v,!At.__hasExternalTextures){const _t=Math.max(1,v.width>>Y),wt=Math.max(1,v.height>>Y);$===i.TEXTURE_3D||$===i.TEXTURE_2D_ARRAY?e.texImage3D($,Y,st,_t,wt,v.depth,0,at,nt,null):e.texImage2D($,Y,st,_t,wt,0,at,nt,null)}e.bindFramebuffer(i.FRAMEBUFFER,T),Mt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,K,$,J.__webglTexture,0,Ht(v)):($===i.TEXTURE_2D||$>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&$<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,K,$,J.__webglTexture,Y),e.bindFramebuffer(i.FRAMEBUFFER,null)}function it(T,v,z){if(i.bindRenderbuffer(i.RENDERBUFFER,T),v.depthBuffer){const K=v.depthTexture,$=K&&K.isDepthTexture?K.type:null,Y=M(v.stencilBuffer,$),at=v.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,nt=Ht(v);Mt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,nt,Y,v.width,v.height):z?i.renderbufferStorageMultisample(i.RENDERBUFFER,nt,Y,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,Y,v.width,v.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,at,i.RENDERBUFFER,T)}else{const K=v.textures;for(let $=0;$<K.length;$++){const Y=K[$],at=r.convert(Y.format,Y.colorSpace),nt=r.convert(Y.type),st=E(Y.internalFormat,at,nt,Y.colorSpace),At=Ht(v);z&&Mt(v)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,At,st,v.width,v.height):Mt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,At,st,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,st,v.width,v.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Tt(T,v){if(v&&v.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,T),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const K=n.get(v.depthTexture);K.__renderTarget=v,(!K.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),G(v.depthTexture,0);const $=K.__webglTexture,Y=Ht(v);if(v.depthTexture.format===1026)Mt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,$,0,Y):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,$,0);else if(v.depthTexture.format===1027)Mt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,$,0,Y):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,$,0);else throw new Error("Unknown depthTexture format")}function Ct(T){const v=n.get(T),z=T.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==T.depthTexture){const K=T.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),K){const $=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,K.removeEventListener("dispose",$)};K.addEventListener("dispose",$),v.__depthDisposeCallback=$}v.__boundDepthTexture=K}if(T.depthTexture&&!v.__autoAllocateDepthBuffer){if(z)throw new Error("target.depthTexture not supported in Cube render targets");Tt(v.__webglFramebuffer,T)}else if(z){v.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[K]),v.__webglDepthbuffer[K]===void 0)v.__webglDepthbuffer[K]=i.createRenderbuffer(),it(v.__webglDepthbuffer[K],T,!1);else{const $=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Y=v.__webglDepthbuffer[K];i.bindRenderbuffer(i.RENDERBUFFER,Y),i.framebufferRenderbuffer(i.FRAMEBUFFER,$,i.RENDERBUFFER,Y)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=i.createRenderbuffer(),it(v.__webglDepthbuffer,T,!1);else{const K=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,$=v.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,$),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,$)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function Bt(T,v,z){const K=n.get(T);v!==void 0&&xt(K.__webglFramebuffer,T,T.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),z!==void 0&&Ct(T)}function te(T){const v=T.texture,z=n.get(T),K=n.get(v);T.addEventListener("dispose",R);const $=T.textures,Y=T.isWebGLCubeRenderTarget===!0,at=$.length>1;if(at||(K.__webglTexture===void 0&&(K.__webglTexture=i.createTexture()),K.__version=v.version,a.memory.textures++),Y){z.__webglFramebuffer=[];for(let nt=0;nt<6;nt++)if(v.mipmaps&&v.mipmaps.length>0){z.__webglFramebuffer[nt]=[];for(let st=0;st<v.mipmaps.length;st++)z.__webglFramebuffer[nt][st]=i.createFramebuffer()}else z.__webglFramebuffer[nt]=i.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){z.__webglFramebuffer=[];for(let nt=0;nt<v.mipmaps.length;nt++)z.__webglFramebuffer[nt]=i.createFramebuffer()}else z.__webglFramebuffer=i.createFramebuffer();if(at)for(let nt=0,st=$.length;nt<st;nt++){const At=n.get($[nt]);At.__webglTexture===void 0&&(At.__webglTexture=i.createTexture(),a.memory.textures++)}if(T.samples>0&&Mt(T)===!1){z.__webglMultisampledFramebuffer=i.createFramebuffer(),z.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let nt=0;nt<$.length;nt++){const st=$[nt];z.__webglColorRenderbuffer[nt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,z.__webglColorRenderbuffer[nt]);const At=r.convert(st.format,st.colorSpace),J=r.convert(st.type),_t=E(st.internalFormat,At,J,st.colorSpace,T.isXRRenderTarget===!0),wt=Ht(T);i.renderbufferStorageMultisample(i.RENDERBUFFER,wt,_t,T.width,T.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+nt,i.RENDERBUFFER,z.__webglColorRenderbuffer[nt])}i.bindRenderbuffer(i.RENDERBUFFER,null),T.depthBuffer&&(z.__webglDepthRenderbuffer=i.createRenderbuffer(),it(z.__webglDepthRenderbuffer,T,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(Y){e.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture),Lt(i.TEXTURE_CUBE_MAP,v);for(let nt=0;nt<6;nt++)if(v.mipmaps&&v.mipmaps.length>0)for(let st=0;st<v.mipmaps.length;st++)xt(z.__webglFramebuffer[nt][st],T,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,st);else xt(z.__webglFramebuffer[nt],T,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0);f(v)&&c(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(at){for(let nt=0,st=$.length;nt<st;nt++){const At=$[nt],J=n.get(At);e.bindTexture(i.TEXTURE_2D,J.__webglTexture),Lt(i.TEXTURE_2D,At),xt(z.__webglFramebuffer,T,At,i.COLOR_ATTACHMENT0+nt,i.TEXTURE_2D,0),f(At)&&c(i.TEXTURE_2D)}e.unbindTexture()}else{let nt=i.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(nt=T.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(nt,K.__webglTexture),Lt(nt,v),v.mipmaps&&v.mipmaps.length>0)for(let st=0;st<v.mipmaps.length;st++)xt(z.__webglFramebuffer[st],T,v,i.COLOR_ATTACHMENT0,nt,st);else xt(z.__webglFramebuffer,T,v,i.COLOR_ATTACHMENT0,nt,0);f(v)&&c(nt),e.unbindTexture()}T.depthBuffer&&Ct(T)}function Vt(T){const v=T.textures;for(let z=0,K=v.length;z<K;z++){const $=v[z];if(f($)){const Y=b(T),at=n.get($).__webglTexture;e.bindTexture(Y,at),c(Y),e.unbindTexture()}}}const re=[],U=[];function Se(T){if(T.samples>0){if(Mt(T)===!1){const v=T.textures,z=T.width,K=T.height;let $=i.COLOR_BUFFER_BIT;const Y=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=n.get(T),nt=v.length>1;if(nt)for(let st=0;st<v.length;st++)e.bindFramebuffer(i.FRAMEBUFFER,at.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+st,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,at.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+st,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,at.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,at.__webglFramebuffer);for(let st=0;st<v.length;st++){if(T.resolveDepthBuffer&&(T.depthBuffer&&($|=i.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&($|=i.STENCIL_BUFFER_BIT)),nt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,at.__webglColorRenderbuffer[st]);const At=n.get(v[st]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,At,0)}i.blitFramebuffer(0,0,z,K,0,0,z,K,$,i.NEAREST),l===!0&&(re.length=0,U.length=0,re.push(i.COLOR_ATTACHMENT0+st),T.depthBuffer&&T.resolveDepthBuffer===!1&&(re.push(Y),U.push(Y),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,U)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,re))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),nt)for(let st=0;st<v.length;st++){e.bindFramebuffer(i.FRAMEBUFFER,at.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+st,i.RENDERBUFFER,at.__webglColorRenderbuffer[st]);const At=n.get(v[st]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,at.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+st,i.TEXTURE_2D,At,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,at.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&l){const v=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[v])}}}function Ht(T){return Math.min(s.maxSamples,T.samples)}function Mt(T){const v=n.get(T);return T.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function ct(T){const v=a.render.frame;u.get(T)!==v&&(u.set(T,v),T.update())}function Wt(T,v){const z=T.colorSpace,K=T.format,$=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||z!==ai&&z!==""&&(qt.getTransfer(z)===Jt?(K!==1023||$!==1009)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",z)),v}function ut(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(h.width=T.naturalWidth||T.width,h.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(h.width=T.displayWidth,h.height=T.displayHeight):(h.width=T.width,h.height=T.height),h}this.allocateTextureUnit=B,this.resetTextureUnits=I,this.setTexture2D=G,this.setTexture2DArray=W,this.setTexture3D=Z,this.setTextureCube=k,this.rebindTextures=Bt,this.setupRenderTarget=te,this.updateRenderTargetMipmap=Vt,this.updateMultisampleRenderTarget=Se,this.setupDepthRenderbuffer=Ct,this.setupFrameBufferTexture=xt,this.useMultisampledRTT=Mt}function _f(i,t){function e(n,s=""){let r;const a=qt.getTransfer(s);if(n===1009)return i.UNSIGNED_BYTE;if(n===1017)return i.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return i.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===1010)return i.BYTE;if(n===1011)return i.SHORT;if(n===1012)return i.UNSIGNED_SHORT;if(n===1013)return i.INT;if(n===1014)return i.UNSIGNED_INT;if(n===1015)return i.FLOAT;if(n===1016)return i.HALF_FLOAT;if(n===1021)return i.ALPHA;if(n===1022)return i.RGB;if(n===1023)return i.RGBA;if(n===1024)return i.LUMINANCE;if(n===1025)return i.LUMINANCE_ALPHA;if(n===1026)return i.DEPTH_COMPONENT;if(n===1027)return i.DEPTH_STENCIL;if(n===1028)return i.RED;if(n===1029)return i.RED_INTEGER;if(n===1030)return i.RG;if(n===1031)return i.RG_INTEGER;if(n===1033)return i.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779)if(a===Jt)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===33776)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===33776)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===35840||n===35841||n===35842||n===35843)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===35840)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===36196||n===37492||n===37496)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===36196||n===37492)return a===Jt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===37496)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===37808)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===36492||n===36494||n===36495)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===36492)return a===Jt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===36283||n===36284||n===36285||n===36286)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===36492)return r.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===1020?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}class xf extends Fe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class fe extends pe{constructor(){super(),this.isGroup=!0,this.type="Group"}}const vf={type:"move"};class rr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new fe,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new fe,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new fe,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,h=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(h&&t.hand){a=!0;for(const g of t.hand.values()){const f=e.getJointPose(g,n),c=this._getHandJoint(h,g);f!==null&&(c.matrix.fromArray(f.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,c.jointRadius=f.radius),c.visible=f!==null}const u=h.joints["index-finger-tip"],p=h.joints["thumb-tip"],d=u.position.distanceTo(p.position),m=.02,_=.005;h.inputState.pinching&&d>m+_?(h.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!h.inputState.pinching&&d<=m-_&&(h.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(vf)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),h!==null&&(h.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new fe;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const Mf=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,yf=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Sf{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const s=new ye,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new ln({vertexShader:Mf,fragmentShader:yf,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new le(new ws(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Ef extends oi{constructor(t,e){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,h=null,u=null,p=null,d=null,m=null,_=null;const g=new Sf,f=e.getContextAttributes();let c=null,b=null;const E=[],M=[],C=new It;let A=null;const R=new Fe;R.viewport=new oe;const P=new Fe;P.viewport=new oe;const S=[R,P],x=new xf;let w=null,I=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let Q=E[q];return Q===void 0&&(Q=new rr,E[q]=Q),Q.getTargetRaySpace()},this.getControllerGrip=function(q){let Q=E[q];return Q===void 0&&(Q=new rr,E[q]=Q),Q.getGripSpace()},this.getHand=function(q){let Q=E[q];return Q===void 0&&(Q=new rr,E[q]=Q),Q.getHandSpace()};function B(q){const Q=M.indexOf(q.inputSource);if(Q===-1)return;const xt=E[Q];xt!==void 0&&(xt.update(q.inputSource,q.frame,h||a),xt.dispatchEvent({type:q.type,data:q.inputSource}))}function O(){s.removeEventListener("select",B),s.removeEventListener("selectstart",B),s.removeEventListener("selectend",B),s.removeEventListener("squeeze",B),s.removeEventListener("squeezestart",B),s.removeEventListener("squeezeend",B),s.removeEventListener("end",O),s.removeEventListener("inputsourceschange",G);for(let q=0;q<E.length;q++){const Q=M[q];Q!==null&&(M[q]=null,E[q].disconnect(Q))}w=null,I=null,g.reset(),t.setRenderTarget(c),m=null,d=null,p=null,s=null,b=null,Xt.stop(),n.isPresenting=!1,t.setPixelRatio(A),t.setSize(C.width,C.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){r=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){o=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return h||a},this.setReferenceSpace=function(q){h=q},this.getBaseLayer=function(){return d!==null?d:m},this.getBinding=function(){return p},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(q){if(s=q,s!==null){if(c=t.getRenderTarget(),s.addEventListener("select",B),s.addEventListener("selectstart",B),s.addEventListener("selectend",B),s.addEventListener("squeeze",B),s.addEventListener("squeezestart",B),s.addEventListener("squeezeend",B),s.addEventListener("end",O),s.addEventListener("inputsourceschange",G),f.xrCompatible!==!0&&await e.makeXRCompatible(),A=t.getPixelRatio(),t.getSize(C),s.renderState.layers===void 0){const Q={antialias:f.antialias,alpha:!0,depth:f.depth,stencil:f.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(s,e,Q),s.updateRenderState({baseLayer:m}),t.setPixelRatio(1),t.setSize(m.framebufferWidth,m.framebufferHeight,!1),b=new Nn(m.framebufferWidth,m.framebufferHeight,{format:1023,type:1009,colorSpace:t.outputColorSpace,stencilBuffer:f.stencil})}else{let Q=null,xt=null,it=null;f.depth&&(it=f.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Q=f.stencil?1027:1026,xt=f.stencil?1020:1014);const Tt={colorFormat:e.RGBA8,depthFormat:it,scaleFactor:r};p=new XRWebGLBinding(s,e),d=p.createProjectionLayer(Tt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),b=new Nn(d.textureWidth,d.textureHeight,{format:1023,type:1009,depthTexture:new Uo(d.textureWidth,d.textureHeight,xt,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:f.stencil,colorSpace:t.outputColorSpace,samples:f.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}b.isXRRenderTarget=!0,this.setFoveation(l),h=null,a=await s.requestReferenceSpace(o),Xt.setContext(s),Xt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function G(q){for(let Q=0;Q<q.removed.length;Q++){const xt=q.removed[Q],it=M.indexOf(xt);it>=0&&(M[it]=null,E[it].disconnect(xt))}for(let Q=0;Q<q.added.length;Q++){const xt=q.added[Q];let it=M.indexOf(xt);if(it===-1){for(let Ct=0;Ct<E.length;Ct++)if(Ct>=M.length){M.push(xt),it=Ct;break}else if(M[Ct]===null){M[Ct]=xt,it=Ct;break}if(it===-1)break}const Tt=E[it];Tt&&Tt.connect(xt)}}const W=new N,Z=new N;function k(q,Q,xt){W.setFromMatrixPosition(Q.matrixWorld),Z.setFromMatrixPosition(xt.matrixWorld);const it=W.distanceTo(Z),Tt=Q.projectionMatrix.elements,Ct=xt.projectionMatrix.elements,Bt=Tt[14]/(Tt[10]-1),te=Tt[14]/(Tt[10]+1),Vt=(Tt[9]+1)/Tt[5],re=(Tt[9]-1)/Tt[5],U=(Tt[8]-1)/Tt[0],Se=(Ct[8]+1)/Ct[0],Ht=Bt*U,Mt=Bt*Se,ct=it/(-U+Se),Wt=ct*-U;if(Q.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(Wt),q.translateZ(ct),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert(),Tt[10]===-1)q.projectionMatrix.copy(Q.projectionMatrix),q.projectionMatrixInverse.copy(Q.projectionMatrixInverse);else{const ut=Bt+ct,T=te+ct,v=Ht-Wt,z=Mt+(it-Wt),K=Vt*te/T*ut,$=re*te/T*ut;q.projectionMatrix.makePerspective(v,z,K,$,ut,T),q.projectionMatrixInverse.copy(q.projectionMatrix).invert()}}function tt(q,Q){Q===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(Q.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.updateCamera=function(q){if(s===null)return;let Q=q.near,xt=q.far;g.texture!==null&&(g.depthNear>0&&(Q=g.depthNear),g.depthFar>0&&(xt=g.depthFar)),x.near=P.near=R.near=Q,x.far=P.far=R.far=xt,(w!==x.near||I!==x.far)&&(s.updateRenderState({depthNear:x.near,depthFar:x.far}),w=x.near,I=x.far),R.layers.mask=q.layers.mask|2,P.layers.mask=q.layers.mask|4,x.layers.mask=R.layers.mask|P.layers.mask;const it=q.parent,Tt=x.cameras;tt(x,it);for(let Ct=0;Ct<Tt.length;Ct++)tt(Tt[Ct],it);Tt.length===2?k(x,R,P):x.projectionMatrix.copy(R.projectionMatrix),lt(q,x,it)};function lt(q,Q,xt){xt===null?q.matrix.copy(Q.matrixWorld):(q.matrix.copy(xt.matrixWorld),q.matrix.invert(),q.matrix.multiply(Q.matrixWorld)),q.matrix.decompose(q.position,q.quaternion,q.scale),q.updateMatrixWorld(!0),q.projectionMatrix.copy(Q.projectionMatrix),q.projectionMatrixInverse.copy(Q.projectionMatrixInverse),q.isPerspectiveCamera&&(q.fov=mr*2*Math.atan(1/q.projectionMatrix.elements[5]),q.zoom=1)}this.getCamera=function(){return x},this.getFoveation=function(){if(!(d===null&&m===null))return l},this.setFoveation=function(q){l=q,d!==null&&(d.fixedFoveation=q),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=q)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(x)};let vt=null;function Lt(q,Q){if(u=Q.getViewerPose(h||a),_=Q,u!==null){const xt=u.views;m!==null&&(t.setRenderTargetFramebuffer(b,m.framebuffer),t.setRenderTarget(b));let it=!1;xt.length!==x.cameras.length&&(x.cameras.length=0,it=!0);for(let Ct=0;Ct<xt.length;Ct++){const Bt=xt[Ct];let te=null;if(m!==null)te=m.getViewport(Bt);else{const re=p.getViewSubImage(d,Bt);te=re.viewport,Ct===0&&(t.setRenderTargetTextures(b,re.colorTexture,d.ignoreDepthValues?void 0:re.depthStencilTexture),t.setRenderTarget(b))}let Vt=S[Ct];Vt===void 0&&(Vt=new Fe,Vt.layers.enable(Ct),Vt.viewport=new oe,S[Ct]=Vt),Vt.matrix.fromArray(Bt.transform.matrix),Vt.matrix.decompose(Vt.position,Vt.quaternion,Vt.scale),Vt.projectionMatrix.fromArray(Bt.projectionMatrix),Vt.projectionMatrixInverse.copy(Vt.projectionMatrix).invert(),Vt.viewport.set(te.x,te.y,te.width,te.height),Ct===0&&(x.matrix.copy(Vt.matrix),x.matrix.decompose(x.position,x.quaternion,x.scale)),it===!0&&x.cameras.push(Vt)}const Tt=s.enabledFeatures;if(Tt&&Tt.includes("depth-sensing")){const Ct=p.getDepthInformation(xt[0]);Ct&&Ct.isValid&&Ct.texture&&g.init(t,Ct,s.renderState)}}for(let xt=0;xt<E.length;xt++){const it=M[xt],Tt=E[xt];it!==null&&Tt!==void 0&&Tt.update(it,Q,h||a)}vt&&vt(q,Q),Q.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Q}),_=null}const Xt=new Do;Xt.setAnimationLoop(Lt),this.setAnimationLoop=function(q){vt=q},this.dispose=function(){}}}const Cn=new Ze,bf=new ne;function Tf(i,t){function e(f,c){f.matrixAutoUpdate===!0&&f.updateMatrix(),c.value.copy(f.matrix)}function n(f,c){c.color.getRGB(f.fogColor.value,Ro(i)),c.isFog?(f.fogNear.value=c.near,f.fogFar.value=c.far):c.isFogExp2&&(f.fogDensity.value=c.density)}function s(f,c,b,E,M){c.isMeshBasicMaterial||c.isMeshLambertMaterial?r(f,c):c.isMeshToonMaterial?(r(f,c),p(f,c)):c.isMeshPhongMaterial?(r(f,c),u(f,c)):c.isMeshStandardMaterial?(r(f,c),d(f,c),c.isMeshPhysicalMaterial&&m(f,c,M)):c.isMeshMatcapMaterial?(r(f,c),_(f,c)):c.isMeshDepthMaterial?r(f,c):c.isMeshDistanceMaterial?(r(f,c),g(f,c)):c.isMeshNormalMaterial?r(f,c):c.isLineBasicMaterial?(a(f,c),c.isLineDashedMaterial&&o(f,c)):c.isPointsMaterial?l(f,c,b,E):c.isSpriteMaterial?h(f,c):c.isShadowMaterial?(f.color.value.copy(c.color),f.opacity.value=c.opacity):c.isShaderMaterial&&(c.uniformsNeedUpdate=!1)}function r(f,c){f.opacity.value=c.opacity,c.color&&f.diffuse.value.copy(c.color),c.emissive&&f.emissive.value.copy(c.emissive).multiplyScalar(c.emissiveIntensity),c.map&&(f.map.value=c.map,e(c.map,f.mapTransform)),c.alphaMap&&(f.alphaMap.value=c.alphaMap,e(c.alphaMap,f.alphaMapTransform)),c.bumpMap&&(f.bumpMap.value=c.bumpMap,e(c.bumpMap,f.bumpMapTransform),f.bumpScale.value=c.bumpScale,c.side===1&&(f.bumpScale.value*=-1)),c.normalMap&&(f.normalMap.value=c.normalMap,e(c.normalMap,f.normalMapTransform),f.normalScale.value.copy(c.normalScale),c.side===1&&f.normalScale.value.negate()),c.displacementMap&&(f.displacementMap.value=c.displacementMap,e(c.displacementMap,f.displacementMapTransform),f.displacementScale.value=c.displacementScale,f.displacementBias.value=c.displacementBias),c.emissiveMap&&(f.emissiveMap.value=c.emissiveMap,e(c.emissiveMap,f.emissiveMapTransform)),c.specularMap&&(f.specularMap.value=c.specularMap,e(c.specularMap,f.specularMapTransform)),c.alphaTest>0&&(f.alphaTest.value=c.alphaTest);const b=t.get(c),E=b.envMap,M=b.envMapRotation;E&&(f.envMap.value=E,Cn.copy(M),Cn.x*=-1,Cn.y*=-1,Cn.z*=-1,E.isCubeTexture&&E.isRenderTargetTexture===!1&&(Cn.y*=-1,Cn.z*=-1),f.envMapRotation.value.setFromMatrix4(bf.makeRotationFromEuler(Cn)),f.flipEnvMap.value=E.isCubeTexture&&E.isRenderTargetTexture===!1?-1:1,f.reflectivity.value=c.reflectivity,f.ior.value=c.ior,f.refractionRatio.value=c.refractionRatio),c.lightMap&&(f.lightMap.value=c.lightMap,f.lightMapIntensity.value=c.lightMapIntensity,e(c.lightMap,f.lightMapTransform)),c.aoMap&&(f.aoMap.value=c.aoMap,f.aoMapIntensity.value=c.aoMapIntensity,e(c.aoMap,f.aoMapTransform))}function a(f,c){f.diffuse.value.copy(c.color),f.opacity.value=c.opacity,c.map&&(f.map.value=c.map,e(c.map,f.mapTransform))}function o(f,c){f.dashSize.value=c.dashSize,f.totalSize.value=c.dashSize+c.gapSize,f.scale.value=c.scale}function l(f,c,b,E){f.diffuse.value.copy(c.color),f.opacity.value=c.opacity,f.size.value=c.size*b,f.scale.value=E*.5,c.map&&(f.map.value=c.map,e(c.map,f.uvTransform)),c.alphaMap&&(f.alphaMap.value=c.alphaMap,e(c.alphaMap,f.alphaMapTransform)),c.alphaTest>0&&(f.alphaTest.value=c.alphaTest)}function h(f,c){f.diffuse.value.copy(c.color),f.opacity.value=c.opacity,f.rotation.value=c.rotation,c.map&&(f.map.value=c.map,e(c.map,f.mapTransform)),c.alphaMap&&(f.alphaMap.value=c.alphaMap,e(c.alphaMap,f.alphaMapTransform)),c.alphaTest>0&&(f.alphaTest.value=c.alphaTest)}function u(f,c){f.specular.value.copy(c.specular),f.shininess.value=Math.max(c.shininess,1e-4)}function p(f,c){c.gradientMap&&(f.gradientMap.value=c.gradientMap)}function d(f,c){f.metalness.value=c.metalness,c.metalnessMap&&(f.metalnessMap.value=c.metalnessMap,e(c.metalnessMap,f.metalnessMapTransform)),f.roughness.value=c.roughness,c.roughnessMap&&(f.roughnessMap.value=c.roughnessMap,e(c.roughnessMap,f.roughnessMapTransform)),c.envMap&&(f.envMapIntensity.value=c.envMapIntensity)}function m(f,c,b){f.ior.value=c.ior,c.sheen>0&&(f.sheenColor.value.copy(c.sheenColor).multiplyScalar(c.sheen),f.sheenRoughness.value=c.sheenRoughness,c.sheenColorMap&&(f.sheenColorMap.value=c.sheenColorMap,e(c.sheenColorMap,f.sheenColorMapTransform)),c.sheenRoughnessMap&&(f.sheenRoughnessMap.value=c.sheenRoughnessMap,e(c.sheenRoughnessMap,f.sheenRoughnessMapTransform))),c.clearcoat>0&&(f.clearcoat.value=c.clearcoat,f.clearcoatRoughness.value=c.clearcoatRoughness,c.clearcoatMap&&(f.clearcoatMap.value=c.clearcoatMap,e(c.clearcoatMap,f.clearcoatMapTransform)),c.clearcoatRoughnessMap&&(f.clearcoatRoughnessMap.value=c.clearcoatRoughnessMap,e(c.clearcoatRoughnessMap,f.clearcoatRoughnessMapTransform)),c.clearcoatNormalMap&&(f.clearcoatNormalMap.value=c.clearcoatNormalMap,e(c.clearcoatNormalMap,f.clearcoatNormalMapTransform),f.clearcoatNormalScale.value.copy(c.clearcoatNormalScale),c.side===1&&f.clearcoatNormalScale.value.negate())),c.dispersion>0&&(f.dispersion.value=c.dispersion),c.iridescence>0&&(f.iridescence.value=c.iridescence,f.iridescenceIOR.value=c.iridescenceIOR,f.iridescenceThicknessMinimum.value=c.iridescenceThicknessRange[0],f.iridescenceThicknessMaximum.value=c.iridescenceThicknessRange[1],c.iridescenceMap&&(f.iridescenceMap.value=c.iridescenceMap,e(c.iridescenceMap,f.iridescenceMapTransform)),c.iridescenceThicknessMap&&(f.iridescenceThicknessMap.value=c.iridescenceThicknessMap,e(c.iridescenceThicknessMap,f.iridescenceThicknessMapTransform))),c.transmission>0&&(f.transmission.value=c.transmission,f.transmissionSamplerMap.value=b.texture,f.transmissionSamplerSize.value.set(b.width,b.height),c.transmissionMap&&(f.transmissionMap.value=c.transmissionMap,e(c.transmissionMap,f.transmissionMapTransform)),f.thickness.value=c.thickness,c.thicknessMap&&(f.thicknessMap.value=c.thicknessMap,e(c.thicknessMap,f.thicknessMapTransform)),f.attenuationDistance.value=c.attenuationDistance,f.attenuationColor.value.copy(c.attenuationColor)),c.anisotropy>0&&(f.anisotropyVector.value.set(c.anisotropy*Math.cos(c.anisotropyRotation),c.anisotropy*Math.sin(c.anisotropyRotation)),c.anisotropyMap&&(f.anisotropyMap.value=c.anisotropyMap,e(c.anisotropyMap,f.anisotropyMapTransform))),f.specularIntensity.value=c.specularIntensity,f.specularColor.value.copy(c.specularColor),c.specularColorMap&&(f.specularColorMap.value=c.specularColorMap,e(c.specularColorMap,f.specularColorMapTransform)),c.specularIntensityMap&&(f.specularIntensityMap.value=c.specularIntensityMap,e(c.specularIntensityMap,f.specularIntensityMapTransform))}function _(f,c){c.matcap&&(f.matcap.value=c.matcap)}function g(f,c){const b=t.get(c).light;f.referencePosition.value.setFromMatrixPosition(b.matrixWorld),f.nearDistance.value=b.shadow.camera.near,f.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Af(i,t,e,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(b,E){const M=E.program;n.uniformBlockBinding(b,M)}function h(b,E){let M=s[b.id];M===void 0&&(_(b),M=u(b),s[b.id]=M,b.addEventListener("dispose",f));const C=E.program;n.updateUBOMapping(b,C);const A=t.render.frame;r[b.id]!==A&&(d(b),r[b.id]=A)}function u(b){const E=p();b.__bindingPointIndex=E;const M=i.createBuffer(),C=b.__size,A=b.usage;return i.bindBuffer(i.UNIFORM_BUFFER,M),i.bufferData(i.UNIFORM_BUFFER,C,A),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,E,M),M}function p(){for(let b=0;b<o;b++)if(a.indexOf(b)===-1)return a.push(b),b;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(b){const E=s[b.id],M=b.uniforms,C=b.__cache;i.bindBuffer(i.UNIFORM_BUFFER,E);for(let A=0,R=M.length;A<R;A++){const P=Array.isArray(M[A])?M[A]:[M[A]];for(let S=0,x=P.length;S<x;S++){const w=P[S];if(m(w,A,S,C)===!0){const I=w.__offset,B=Array.isArray(w.value)?w.value:[w.value];let O=0;for(let G=0;G<B.length;G++){const W=B[G],Z=g(W);typeof W=="number"||typeof W=="boolean"?(w.__data[0]=W,i.bufferSubData(i.UNIFORM_BUFFER,I+O,w.__data)):W.isMatrix3?(w.__data[0]=W.elements[0],w.__data[1]=W.elements[1],w.__data[2]=W.elements[2],w.__data[3]=0,w.__data[4]=W.elements[3],w.__data[5]=W.elements[4],w.__data[6]=W.elements[5],w.__data[7]=0,w.__data[8]=W.elements[6],w.__data[9]=W.elements[7],w.__data[10]=W.elements[8],w.__data[11]=0):(W.toArray(w.__data,O),O+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,I,w.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function m(b,E,M,C){const A=b.value,R=E+"_"+M;if(C[R]===void 0)return typeof A=="number"||typeof A=="boolean"?C[R]=A:C[R]=A.clone(),!0;{const P=C[R];if(typeof A=="number"||typeof A=="boolean"){if(P!==A)return C[R]=A,!0}else if(P.equals(A)===!1)return P.copy(A),!0}return!1}function _(b){const E=b.uniforms;let M=0;const C=16;for(let R=0,P=E.length;R<P;R++){const S=Array.isArray(E[R])?E[R]:[E[R]];for(let x=0,w=S.length;x<w;x++){const I=S[x],B=Array.isArray(I.value)?I.value:[I.value];for(let O=0,G=B.length;O<G;O++){const W=B[O],Z=g(W),k=M%C,tt=k%Z.boundary,lt=k+tt;M+=tt,lt!==0&&C-lt<Z.storage&&(M+=C-lt),I.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),I.__offset=M,M+=Z.storage}}}const A=M%C;return A>0&&(M+=C-A),b.__size=M,b.__cache={},this}function g(b){const E={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(E.boundary=4,E.storage=4):b.isVector2?(E.boundary=8,E.storage=8):b.isVector3||b.isColor?(E.boundary=16,E.storage=12):b.isVector4?(E.boundary=16,E.storage=16):b.isMatrix3?(E.boundary=48,E.storage=48):b.isMatrix4?(E.boundary=64,E.storage=64):b.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",b),E}function f(b){const E=b.target;E.removeEventListener("dispose",f);const M=a.indexOf(E.__bindingPointIndex);a.splice(M,1),i.deleteBuffer(s[E.id]),delete s[E.id],delete r[E.id]}function c(){for(const b in s)i.deleteBuffer(s[b]);a=[],s={},r={}}return{bind:l,update:h,dispose:c}}class wf{constructor(t={}){const{canvas:e=pl(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:h=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:p=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let m;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=n.getContextAttributes().alpha}else m=a;const _=new Uint32Array(4),g=new Int32Array(4);let f=null,c=null;const b=[],E=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Te,this.toneMapping=0,this.toneMappingExposure=1;const M=this;let C=!1,A=0,R=0,P=null,S=-1,x=null;const w=new oe,I=new oe;let B=null;const O=new gt(0);let G=0,W=e.width,Z=e.height,k=1,tt=null,lt=null;const vt=new oe(0,0,W,Z),Lt=new oe(0,0,W,Z);let Xt=!1;const q=new Tr;let Q=!1,xt=!1;const it=new ne,Tt=new ne,Ct=new N,Bt=new oe,te={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Vt=!1;function re(){return P===null?k:1}let U=n;function Se(y,L){return e.getContext(y,L)}try{const y={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:h,powerPreference:u,failIfMajorPerformanceCaveat:p};if("setAttribute"in e&&e.setAttribute("data-engine","three.js r170"),e.addEventListener("webglcontextlost",j,!1),e.addEventListener("webglcontextrestored",pt,!1),e.addEventListener("webglcontextcreationerror",dt,!1),U===null){const L="webgl2";if(U=Se(L,y),U===null)throw Se(L)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(y){throw console.error("THREE.WebGLRenderer: "+y.message),y}let Ht,Mt,ct,Wt,ut,T,v,z,K,$,Y,at,nt,st,At,J,_t,wt,Rt,mt,kt,Dt,Yt,D;function rt(){Ht=new Du(U),Ht.init(),Dt=new _f(U,Ht),Mt=new Tu(U,Ht,t,Dt),ct=new pf(U,Ht),Mt.reverseDepthBuffer&&d&&ct.buffers.depth.setReversed(!0),Wt=new Fu(U),ut=new Jd,T=new gf(U,Ht,ct,ut,Mt,Dt,Wt),v=new wu(M),z=new Pu(M),K=new Vl(U),Yt=new Eu(U,K),$=new Lu(U,K,Wt,Yt),Y=new Iu(U,$,K,Wt),Rt=new Nu(U,Mt,T),J=new Au(ut),at=new $d(M,v,z,Ht,Mt,Yt,J),nt=new Tf(M,ut),st=new tf,At=new of(Ht),wt=new Su(M,v,z,ct,Y,m,l),_t=new df(M,Y,Mt),D=new Af(U,Wt,Mt,ct),mt=new bu(U,Ht,Wt),kt=new Uu(U,Ht,Wt),Wt.programs=at.programs,M.capabilities=Mt,M.extensions=Ht,M.properties=ut,M.renderLists=st,M.shadowMap=_t,M.state=ct,M.info=Wt}rt();const X=new Ef(M,U);this.xr=X,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){const y=Ht.get("WEBGL_lose_context");y&&y.loseContext()},this.forceContextRestore=function(){const y=Ht.get("WEBGL_lose_context");y&&y.restoreContext()},this.getPixelRatio=function(){return k},this.setPixelRatio=function(y){y!==void 0&&(k=y,this.setSize(W,Z,!1))},this.getSize=function(y){return y.set(W,Z)},this.setSize=function(y,L,V=!0){if(X.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=y,Z=L,e.width=Math.floor(y*k),e.height=Math.floor(L*k),V===!0&&(e.style.width=y+"px",e.style.height=L+"px"),this.setViewport(0,0,y,L)},this.getDrawingBufferSize=function(y){return y.set(W*k,Z*k).floor()},this.setDrawingBufferSize=function(y,L,V){W=y,Z=L,k=V,e.width=Math.floor(y*V),e.height=Math.floor(L*V),this.setViewport(0,0,y,L)},this.getCurrentViewport=function(y){return y.copy(w)},this.getViewport=function(y){return y.copy(vt)},this.setViewport=function(y,L,V,H){y.isVector4?vt.set(y.x,y.y,y.z,y.w):vt.set(y,L,V,H),ct.viewport(w.copy(vt).multiplyScalar(k).round())},this.getScissor=function(y){return y.copy(Lt)},this.setScissor=function(y,L,V,H){y.isVector4?Lt.set(y.x,y.y,y.z,y.w):Lt.set(y,L,V,H),ct.scissor(I.copy(Lt).multiplyScalar(k).round())},this.getScissorTest=function(){return Xt},this.setScissorTest=function(y){ct.setScissorTest(Xt=y)},this.setOpaqueSort=function(y){tt=y},this.setTransparentSort=function(y){lt=y},this.getClearColor=function(y){return y.copy(wt.getClearColor())},this.setClearColor=function(){wt.setClearColor.apply(wt,arguments)},this.getClearAlpha=function(){return wt.getClearAlpha()},this.setClearAlpha=function(){wt.setClearAlpha.apply(wt,arguments)},this.clear=function(y=!0,L=!0,V=!0){let H=0;if(y){let F=!1;if(P!==null){const et=P.texture.format;F=et===1033||et===1031||et===1029}if(F){const et=P.texture.type,ft=et===1009||et===1014||et===1012||et===1020||et===1017||et===1018,yt=wt.getClearColor(),St=wt.getClearAlpha(),Pt=yt.r,Ft=yt.g,Et=yt.b;ft?(_[0]=Pt,_[1]=Ft,_[2]=Et,_[3]=St,U.clearBufferuiv(U.COLOR,0,_)):(g[0]=Pt,g[1]=Ft,g[2]=Et,g[3]=St,U.clearBufferiv(U.COLOR,0,g))}else H|=U.COLOR_BUFFER_BIT}L&&(H|=U.DEPTH_BUFFER_BIT),V&&(H|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),U.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",j,!1),e.removeEventListener("webglcontextrestored",pt,!1),e.removeEventListener("webglcontextcreationerror",dt,!1),st.dispose(),At.dispose(),ut.dispose(),v.dispose(),z.dispose(),Y.dispose(),Yt.dispose(),D.dispose(),at.dispose(),X.dispose(),X.removeEventListener("sessionstart",Gr),X.removeEventListener("sessionend",Vr),En.stop()};function j(y){y.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),C=!0}function pt(){console.log("THREE.WebGLRenderer: Context Restored."),C=!1;const y=Wt.autoReset,L=_t.enabled,V=_t.autoUpdate,H=_t.needsUpdate,F=_t.type;rt(),Wt.autoReset=y,_t.enabled=L,_t.autoUpdate=V,_t.needsUpdate=H,_t.type=F}function dt(y){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",y.statusMessage)}function Ut(y){const L=y.target;L.removeEventListener("dispose",Ut),ae(L)}function ae(y){xe(y),ut.remove(y)}function xe(y){const L=ut.get(y).programs;L!==void 0&&(L.forEach(function(V){at.releaseProgram(V)}),y.isShaderMaterial&&at.releaseShaderCache(y))}this.renderBufferDirect=function(y,L,V,H,F,et){L===null&&(L=te);const ft=F.isMesh&&F.matrixWorld.determinant()<0,yt=hl(y,L,V,H,F);ct.setMaterial(H,ft);let St=V.index,Pt=1;if(H.wireframe===!0){if(St=$.getWireframeAttribute(V),St===void 0)return;Pt=2}const Ft=V.drawRange,Et=V.attributes.position;let Kt=Ft.start*Pt,ee=(Ft.start+Ft.count)*Pt;et!==null&&(Kt=Math.max(Kt,et.start*Pt),ee=Math.min(ee,(et.start+et.count)*Pt)),St!==null?(Kt=Math.max(Kt,0),ee=Math.min(ee,St.count)):Et!=null&&(Kt=Math.max(Kt,0),ee=Math.min(ee,Et.count));const ie=ee-Kt;if(ie<0||ie===1/0)return;Yt.setup(F,H,yt,V,St);let Ae,jt=mt;if(St!==null&&(Ae=K.get(St),jt=kt,jt.setIndex(Ae)),F.isMesh)H.wireframe===!0?(ct.setLineWidth(H.wireframeLinewidth*re()),jt.setMode(U.LINES)):jt.setMode(U.TRIANGLES);else if(F.isLine){let bt=H.linewidth;bt===void 0&&(bt=1),ct.setLineWidth(bt*re()),F.isLineSegments?jt.setMode(U.LINES):F.isLineLoop?jt.setMode(U.LINE_LOOP):jt.setMode(U.LINE_STRIP)}else F.isPoints?jt.setMode(U.POINTS):F.isSprite&&jt.setMode(U.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)jt.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(Ht.get("WEBGL_multi_draw"))jt.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const bt=F._multiDrawStarts,Je=F._multiDrawCounts,Zt=F._multiDrawCount,ze=St?K.get(St).bytesPerElement:1,In=ut.get(H).currentProgram.getUniforms();for(let Re=0;Re<Zt;Re++)In.setValue(U,"_gl_DrawID",Re),jt.render(bt[Re]/ze,Je[Re])}else if(F.isInstancedMesh)jt.renderInstances(Kt,ie,F.count);else if(V.isInstancedBufferGeometry){const bt=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,Je=Math.min(V.instanceCount,bt);jt.renderInstances(Kt,ie,Je)}else jt.render(Kt,ie)};function $t(y,L,V){y.transparent===!0&&y.side===2&&y.forceSinglePass===!1?(y.side=1,y.needsUpdate=!0,Oi(y,L,V),y.side=0,y.needsUpdate=!0,Oi(y,L,V),y.side=2):Oi(y,L,V)}this.compile=function(y,L,V=null){V===null&&(V=y),c=At.get(V),c.init(L),E.push(c),V.traverseVisible(function(F){F.isLight&&F.layers.test(L.layers)&&(c.pushLight(F),F.castShadow&&c.pushShadow(F))}),y!==V&&y.traverseVisible(function(F){F.isLight&&F.layers.test(L.layers)&&(c.pushLight(F),F.castShadow&&c.pushShadow(F))}),c.setupLights();const H=new Set;return y.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const et=F.material;if(et)if(Array.isArray(et))for(let ft=0;ft<et.length;ft++){const yt=et[ft];$t(yt,V,F),H.add(yt)}else $t(et,V,F),H.add(et)}),E.pop(),c=null,H},this.compileAsync=function(y,L,V=null){const H=this.compile(y,L,V);return new Promise(F=>{function et(){if(H.forEach(function(ft){ut.get(ft).currentProgram.isReady()&&H.delete(ft)}),H.size===0){F(y);return}setTimeout(et,10)}Ht.get("KHR_parallel_shader_compile")!==null?et():setTimeout(et,10)})};let Oe=null;function $e(y){Oe&&Oe(y)}function Gr(){En.stop()}function Vr(){En.start()}const En=new Do;En.setAnimationLoop($e),typeof self<"u"&&En.setContext(self),this.setAnimationLoop=function(y){Oe=y,X.setAnimationLoop(y),y===null?En.stop():En.start()},X.addEventListener("sessionstart",Gr),X.addEventListener("sessionend",Vr),this.render=function(y,L){if(L!==void 0&&L.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;if(y.matrixWorldAutoUpdate===!0&&y.updateMatrixWorld(),L.parent===null&&L.matrixWorldAutoUpdate===!0&&L.updateMatrixWorld(),X.enabled===!0&&X.isPresenting===!0&&(X.cameraAutoUpdate===!0&&X.updateCamera(L),L=X.getCamera()),y.isScene===!0&&y.onBeforeRender(M,y,L,P),c=At.get(y,E.length),c.init(L),E.push(c),Tt.multiplyMatrices(L.projectionMatrix,L.matrixWorldInverse),q.setFromProjectionMatrix(Tt),xt=this.localClippingEnabled,Q=J.init(this.clippingPlanes,xt),f=st.get(y,b.length),f.init(),b.push(f),X.enabled===!0&&X.isPresenting===!0){const et=M.xr.getDepthSensingMesh();et!==null&&Ps(et,L,-1/0,M.sortObjects)}Ps(y,L,0,M.sortObjects),f.finish(),M.sortObjects===!0&&f.sort(tt,lt),Vt=X.enabled===!1||X.isPresenting===!1||X.hasDepthSensing()===!1,Vt&&wt.addToRenderList(f,y),this.info.render.frame++,Q===!0&&J.beginShadows();const V=c.state.shadowsArray;_t.render(V,y,L),Q===!0&&J.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=f.opaque,F=f.transmissive;if(c.setupLights(),L.isArrayCamera){const et=L.cameras;if(F.length>0)for(let ft=0,yt=et.length;ft<yt;ft++){const St=et[ft];kr(H,F,y,St)}Vt&&wt.render(y);for(let ft=0,yt=et.length;ft<yt;ft++){const St=et[ft];Hr(f,y,St,St.viewport)}}else F.length>0&&kr(H,F,y,L),Vt&&wt.render(y),Hr(f,y,L);P!==null&&(T.updateMultisampleRenderTarget(P),T.updateRenderTargetMipmap(P)),y.isScene===!0&&y.onAfterRender(M,y,L),Yt.resetDefaultState(),S=-1,x=null,E.pop(),E.length>0?(c=E[E.length-1],Q===!0&&J.setGlobalState(M.clippingPlanes,c.state.camera)):c=null,b.pop(),b.length>0?f=b[b.length-1]:f=null};function Ps(y,L,V,H){if(y.visible===!1)return;if(y.layers.test(L.layers)){if(y.isGroup)V=y.renderOrder;else if(y.isLOD)y.autoUpdate===!0&&y.update(L);else if(y.isLight)c.pushLight(y),y.castShadow&&c.pushShadow(y);else if(y.isSprite){if(!y.frustumCulled||q.intersectsSprite(y)){H&&Bt.setFromMatrixPosition(y.matrixWorld).applyMatrix4(Tt);const ft=Y.update(y),yt=y.material;yt.visible&&f.push(y,ft,yt,V,Bt.z,null)}}else if((y.isMesh||y.isLine||y.isPoints)&&(!y.frustumCulled||q.intersectsObject(y))){const ft=Y.update(y),yt=y.material;if(H&&(y.boundingSphere!==void 0?(y.boundingSphere===null&&y.computeBoundingSphere(),Bt.copy(y.boundingSphere.center)):(ft.boundingSphere===null&&ft.computeBoundingSphere(),Bt.copy(ft.boundingSphere.center)),Bt.applyMatrix4(y.matrixWorld).applyMatrix4(Tt)),Array.isArray(yt)){const St=ft.groups;for(let Pt=0,Ft=St.length;Pt<Ft;Pt++){const Et=St[Pt],Kt=yt[Et.materialIndex];Kt&&Kt.visible&&f.push(y,ft,Kt,V,Bt.z,Et)}}else yt.visible&&f.push(y,ft,yt,V,Bt.z,null)}}const et=y.children;for(let ft=0,yt=et.length;ft<yt;ft++)Ps(et[ft],L,V,H)}function Hr(y,L,V,H){const F=y.opaque,et=y.transmissive,ft=y.transparent;c.setupLightsView(V),Q===!0&&J.setGlobalState(M.clippingPlanes,V),H&&ct.viewport(w.copy(H)),F.length>0&&Bi(F,L,V),et.length>0&&Bi(et,L,V),ft.length>0&&Bi(ft,L,V),ct.buffers.depth.setTest(!0),ct.buffers.depth.setMask(!0),ct.buffers.color.setMask(!0),ct.setPolygonOffset(!1)}function kr(y,L,V,H){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;c.state.transmissionRenderTarget[H.id]===void 0&&(c.state.transmissionRenderTarget[H.id]=new Nn(1,1,{generateMipmaps:!0,type:Ht.has("EXT_color_buffer_half_float")||Ht.has("EXT_color_buffer_float")?1016:1009,minFilter:1008,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:qt.workingColorSpace}));const et=c.state.transmissionRenderTarget[H.id],ft=H.viewport||w;et.setSize(ft.z,ft.w);const yt=M.getRenderTarget();M.setRenderTarget(et),M.getClearColor(O),G=M.getClearAlpha(),G<1&&M.setClearColor(16777215,.5),M.clear(),Vt&&wt.render(V);const St=M.toneMapping;M.toneMapping=0;const Pt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),c.setupLightsView(H),Q===!0&&J.setGlobalState(M.clippingPlanes,H),Bi(y,V,H),T.updateMultisampleRenderTarget(et),T.updateRenderTargetMipmap(et),Ht.has("WEBGL_multisampled_render_to_texture")===!1){let Ft=!1;for(let Et=0,Kt=L.length;Et<Kt;Et++){const ee=L[Et],ie=ee.object,Ae=ee.geometry,jt=ee.material,bt=ee.group;if(jt.side===2&&ie.layers.test(H.layers)){const Je=jt.side;jt.side=1,jt.needsUpdate=!0,Wr(ie,V,H,Ae,jt,bt),jt.side=Je,jt.needsUpdate=!0,Ft=!0}}Ft===!0&&(T.updateMultisampleRenderTarget(et),T.updateRenderTargetMipmap(et))}M.setRenderTarget(yt),M.setClearColor(O,G),Pt!==void 0&&(H.viewport=Pt),M.toneMapping=St}function Bi(y,L,V){const H=L.isScene===!0?L.overrideMaterial:null;for(let F=0,et=y.length;F<et;F++){const ft=y[F],yt=ft.object,St=ft.geometry,Pt=H===null?ft.material:H,Ft=ft.group;yt.layers.test(V.layers)&&Wr(yt,L,V,St,Pt,Ft)}}function Wr(y,L,V,H,F,et){y.onBeforeRender(M,L,V,H,F,et),y.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,y.matrixWorld),y.normalMatrix.getNormalMatrix(y.modelViewMatrix),F.onBeforeRender(M,L,V,H,y,et),F.transparent===!0&&F.side===2&&F.forceSinglePass===!1?(F.side=1,F.needsUpdate=!0,M.renderBufferDirect(V,L,H,F,y,et),F.side=0,F.needsUpdate=!0,M.renderBufferDirect(V,L,H,F,y,et),F.side=2):M.renderBufferDirect(V,L,H,F,y,et),y.onAfterRender(M,L,V,H,F,et)}function Oi(y,L,V){L.isScene!==!0&&(L=te);const H=ut.get(y),F=c.state.lights,et=c.state.shadowsArray,ft=F.state.version,yt=at.getParameters(y,F.state,et,L,V),St=at.getProgramCacheKey(yt);let Pt=H.programs;H.environment=y.isMeshStandardMaterial?L.environment:null,H.fog=L.fog,H.envMap=(y.isMeshStandardMaterial?z:v).get(y.envMap||H.environment),H.envMapRotation=H.environment!==null&&y.envMap===null?L.environmentRotation:y.envMapRotation,Pt===void 0&&(y.addEventListener("dispose",Ut),Pt=new Map,H.programs=Pt);let Ft=Pt.get(St);if(Ft!==void 0){if(H.currentProgram===Ft&&H.lightsStateVersion===ft)return qr(y,yt),Ft}else yt.uniforms=at.getUniforms(y),y.onBeforeCompile(yt,M),Ft=at.acquireProgram(yt,St),Pt.set(St,Ft),H.uniforms=yt.uniforms;const Et=H.uniforms;return(!y.isShaderMaterial&&!y.isRawShaderMaterial||y.clipping===!0)&&(Et.clippingPlanes=J.uniform),qr(y,yt),H.needsLights=dl(y),H.lightsStateVersion=ft,H.needsLights&&(Et.ambientLightColor.value=F.state.ambient,Et.lightProbe.value=F.state.probe,Et.directionalLights.value=F.state.directional,Et.directionalLightShadows.value=F.state.directionalShadow,Et.spotLights.value=F.state.spot,Et.spotLightShadows.value=F.state.spotShadow,Et.rectAreaLights.value=F.state.rectArea,Et.ltc_1.value=F.state.rectAreaLTC1,Et.ltc_2.value=F.state.rectAreaLTC2,Et.pointLights.value=F.state.point,Et.pointLightShadows.value=F.state.pointShadow,Et.hemisphereLights.value=F.state.hemi,Et.directionalShadowMap.value=F.state.directionalShadowMap,Et.directionalShadowMatrix.value=F.state.directionalShadowMatrix,Et.spotShadowMap.value=F.state.spotShadowMap,Et.spotLightMatrix.value=F.state.spotLightMatrix,Et.spotLightMap.value=F.state.spotLightMap,Et.pointShadowMap.value=F.state.pointShadowMap,Et.pointShadowMatrix.value=F.state.pointShadowMatrix),H.currentProgram=Ft,H.uniformsList=null,Ft}function Xr(y){if(y.uniformsList===null){const L=y.currentProgram.getUniforms();y.uniformsList=_s.seqWithValue(L.seq,y.uniforms)}return y.uniformsList}function qr(y,L){const V=ut.get(y);V.outputColorSpace=L.outputColorSpace,V.batching=L.batching,V.batchingColor=L.batchingColor,V.instancing=L.instancing,V.instancingColor=L.instancingColor,V.instancingMorph=L.instancingMorph,V.skinning=L.skinning,V.morphTargets=L.morphTargets,V.morphNormals=L.morphNormals,V.morphColors=L.morphColors,V.morphTargetsCount=L.morphTargetsCount,V.numClippingPlanes=L.numClippingPlanes,V.numIntersection=L.numClipIntersection,V.vertexAlphas=L.vertexAlphas,V.vertexTangents=L.vertexTangents,V.toneMapping=L.toneMapping}function hl(y,L,V,H,F){L.isScene!==!0&&(L=te),T.resetTextureUnits();const et=L.fog,ft=H.isMeshStandardMaterial?L.environment:null,yt=P===null?M.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:ai,St=(H.isMeshStandardMaterial?z:v).get(H.envMap||ft),Pt=H.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,Ft=!!V.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Et=!!V.morphAttributes.position,Kt=!!V.morphAttributes.normal,ee=!!V.morphAttributes.color;let ie=0;H.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(ie=M.toneMapping);const Ae=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,jt=Ae!==void 0?Ae.length:0,bt=ut.get(H),Je=c.state.lights;if(Q===!0&&(xt===!0||y!==x)){const Le=y===x&&H.id===S;J.setState(H,y,Le)}let Zt=!1;H.version===bt.__version?(bt.needsLights&&bt.lightsStateVersion!==Je.state.version||bt.outputColorSpace!==yt||F.isBatchedMesh&&bt.batching===!1||!F.isBatchedMesh&&bt.batching===!0||F.isBatchedMesh&&bt.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&bt.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&bt.instancing===!1||!F.isInstancedMesh&&bt.instancing===!0||F.isSkinnedMesh&&bt.skinning===!1||!F.isSkinnedMesh&&bt.skinning===!0||F.isInstancedMesh&&bt.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&bt.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&bt.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&bt.instancingMorph===!1&&F.morphTexture!==null||bt.envMap!==St||H.fog===!0&&bt.fog!==et||bt.numClippingPlanes!==void 0&&(bt.numClippingPlanes!==J.numPlanes||bt.numIntersection!==J.numIntersection)||bt.vertexAlphas!==Pt||bt.vertexTangents!==Ft||bt.morphTargets!==Et||bt.morphNormals!==Kt||bt.morphColors!==ee||bt.toneMapping!==ie||bt.morphTargetsCount!==jt)&&(Zt=!0):(Zt=!0,bt.__version=H.version);let ze=bt.currentProgram;Zt===!0&&(ze=Oi(H,L,F));let In=!1,Re=!1,ci=!1;const se=ze.getUniforms(),We=bt.uniforms;if(ct.useProgram(ze.program)&&(In=!0,Re=!0,ci=!0),H.id!==S&&(S=H.id,Re=!0),In||x!==y){ct.buffers.depth.getReversed()?(it.copy(y.projectionMatrix),gl(it),_l(it),se.setValue(U,"projectionMatrix",it)):se.setValue(U,"projectionMatrix",y.projectionMatrix),se.setValue(U,"viewMatrix",y.matrixWorldInverse);const un=se.map.cameraPosition;un!==void 0&&un.setValue(U,Ct.setFromMatrixPosition(y.matrixWorld)),Mt.logarithmicDepthBuffer&&se.setValue(U,"logDepthBufFC",2/(Math.log(y.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&se.setValue(U,"isOrthographic",y.isOrthographicCamera===!0),x!==y&&(x=y,Re=!0,ci=!0)}if(F.isSkinnedMesh){se.setOptional(U,F,"bindMatrix"),se.setOptional(U,F,"bindMatrixInverse");const Le=F.skeleton;Le&&(Le.boneTexture===null&&Le.computeBoneTexture(),se.setValue(U,"boneTexture",Le.boneTexture,T))}F.isBatchedMesh&&(se.setOptional(U,F,"batchingTexture"),se.setValue(U,"batchingTexture",F._matricesTexture,T),se.setOptional(U,F,"batchingIdTexture"),se.setValue(U,"batchingIdTexture",F._indirectTexture,T),se.setOptional(U,F,"batchingColorTexture"),F._colorsTexture!==null&&se.setValue(U,"batchingColorTexture",F._colorsTexture,T));const hi=V.morphAttributes;if((hi.position!==void 0||hi.normal!==void 0||hi.color!==void 0)&&Rt.update(F,V,ze),(Re||bt.receiveShadow!==F.receiveShadow)&&(bt.receiveShadow=F.receiveShadow,se.setValue(U,"receiveShadow",F.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(We.envMap.value=St,We.flipEnvMap.value=St.isCubeTexture&&St.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&L.environment!==null&&(We.envMapIntensity.value=L.environmentIntensity),Re&&(se.setValue(U,"toneMappingExposure",M.toneMappingExposure),bt.needsLights&&ul(We,ci),et&&H.fog===!0&&nt.refreshFogUniforms(We,et),nt.refreshMaterialUniforms(We,H,k,Z,c.state.transmissionRenderTarget[y.id]),_s.upload(U,Xr(bt),We,T)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(_s.upload(U,Xr(bt),We,T),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&se.setValue(U,"center",F.center),se.setValue(U,"modelViewMatrix",F.modelViewMatrix),se.setValue(U,"normalMatrix",F.normalMatrix),se.setValue(U,"modelMatrix",F.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const Le=H.uniformsGroups;for(let un=0,dn=Le.length;un<dn;un++){const Yr=Le[un];D.update(Yr,ze),D.bind(Yr,ze)}}return ze}function ul(y,L){y.ambientLightColor.needsUpdate=L,y.lightProbe.needsUpdate=L,y.directionalLights.needsUpdate=L,y.directionalLightShadows.needsUpdate=L,y.pointLights.needsUpdate=L,y.pointLightShadows.needsUpdate=L,y.spotLights.needsUpdate=L,y.spotLightShadows.needsUpdate=L,y.rectAreaLights.needsUpdate=L,y.hemisphereLights.needsUpdate=L}function dl(y){return y.isMeshLambertMaterial||y.isMeshToonMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isShadowMaterial||y.isShaderMaterial&&y.lights===!0}this.getActiveCubeFace=function(){return A},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(y,L,V){ut.get(y.texture).__webglTexture=L,ut.get(y.depthTexture).__webglTexture=V;const H=ut.get(y);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=V===void 0,H.__autoAllocateDepthBuffer||Ht.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(y,L){const V=ut.get(y);V.__webglFramebuffer=L,V.__useDefaultFramebuffer=L===void 0},this.setRenderTarget=function(y,L=0,V=0){P=y,A=L,R=V;let H=!0,F=null,et=!1,ft=!1;if(y){const St=ut.get(y);if(St.__useDefaultFramebuffer!==void 0)ct.bindFramebuffer(U.FRAMEBUFFER,null),H=!1;else if(St.__webglFramebuffer===void 0)T.setupRenderTarget(y);else if(St.__hasExternalTextures)T.rebindTextures(y,ut.get(y.texture).__webglTexture,ut.get(y.depthTexture).__webglTexture);else if(y.depthBuffer){const Et=y.depthTexture;if(St.__boundDepthTexture!==Et){if(Et!==null&&ut.has(Et)&&(y.width!==Et.image.width||y.height!==Et.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");T.setupDepthRenderbuffer(y)}}const Pt=y.texture;(Pt.isData3DTexture||Pt.isDataArrayTexture||Pt.isCompressedArrayTexture)&&(ft=!0);const Ft=ut.get(y).__webglFramebuffer;y.isWebGLCubeRenderTarget?(Array.isArray(Ft[L])?F=Ft[L][V]:F=Ft[L],et=!0):y.samples>0&&T.useMultisampledRTT(y)===!1?F=ut.get(y).__webglMultisampledFramebuffer:Array.isArray(Ft)?F=Ft[V]:F=Ft,w.copy(y.viewport),I.copy(y.scissor),B=y.scissorTest}else w.copy(vt).multiplyScalar(k).floor(),I.copy(Lt).multiplyScalar(k).floor(),B=Xt;if(ct.bindFramebuffer(U.FRAMEBUFFER,F)&&H&&ct.drawBuffers(y,F),ct.viewport(w),ct.scissor(I),ct.setScissorTest(B),et){const St=ut.get(y.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+L,St.__webglTexture,V)}else if(ft){const St=ut.get(y.texture),Pt=L||0;U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,St.__webglTexture,V||0,Pt)}S=-1},this.readRenderTargetPixels=function(y,L,V,H,F,et,ft){if(!(y&&y.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let yt=ut.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&ft!==void 0&&(yt=yt[ft]),yt){ct.bindFramebuffer(U.FRAMEBUFFER,yt);try{const St=y.texture,Pt=St.format,Ft=St.type;if(!Mt.textureFormatReadable(Pt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Mt.textureTypeReadable(Ft)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}L>=0&&L<=y.width-H&&V>=0&&V<=y.height-F&&U.readPixels(L,V,H,F,Dt.convert(Pt),Dt.convert(Ft),et)}finally{const St=P!==null?ut.get(P).__webglFramebuffer:null;ct.bindFramebuffer(U.FRAMEBUFFER,St)}}},this.readRenderTargetPixelsAsync=async function(y,L,V,H,F,et,ft){if(!(y&&y.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let yt=ut.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&ft!==void 0&&(yt=yt[ft]),yt){const St=y.texture,Pt=St.format,Ft=St.type;if(!Mt.textureFormatReadable(Pt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Mt.textureTypeReadable(Ft))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(L>=0&&L<=y.width-H&&V>=0&&V<=y.height-F){ct.bindFramebuffer(U.FRAMEBUFFER,yt);const Et=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,Et),U.bufferData(U.PIXEL_PACK_BUFFER,et.byteLength,U.STREAM_READ),U.readPixels(L,V,H,F,Dt.convert(Pt),Dt.convert(Ft),0);const Kt=P!==null?ut.get(P).__webglFramebuffer:null;ct.bindFramebuffer(U.FRAMEBUFFER,Kt);const ee=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await ml(U,ee,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,Et),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,et),U.deleteBuffer(Et),U.deleteSync(ee),et}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(y,L=null,V=0){y.isTexture!==!0&&(Ei("WebGLRenderer: copyFramebufferToTexture function signature has changed."),L=arguments[0]||null,y=arguments[1]);const H=Math.pow(2,-V),F=Math.floor(y.image.width*H),et=Math.floor(y.image.height*H),ft=L!==null?L.x:0,yt=L!==null?L.y:0;T.setTexture2D(y,0),U.copyTexSubImage2D(U.TEXTURE_2D,V,0,0,ft,yt,F,et),ct.unbindTexture()},this.copyTextureToTexture=function(y,L,V=null,H=null,F=0){y.isTexture!==!0&&(Ei("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,y=arguments[1],L=arguments[2],F=arguments[3]||0,V=null);let et,ft,yt,St,Pt,Ft,Et,Kt,ee;const ie=y.isCompressedTexture?y.mipmaps[F]:y.image;V!==null?(et=V.max.x-V.min.x,ft=V.max.y-V.min.y,yt=V.isBox3?V.max.z-V.min.z:1,St=V.min.x,Pt=V.min.y,Ft=V.isBox3?V.min.z:0):(et=ie.width,ft=ie.height,yt=ie.depth||1,St=0,Pt=0,Ft=0),H!==null?(Et=H.x,Kt=H.y,ee=H.z):(Et=0,Kt=0,ee=0);const Ae=Dt.convert(L.format),jt=Dt.convert(L.type);let bt;L.isData3DTexture?(T.setTexture3D(L,0),bt=U.TEXTURE_3D):L.isDataArrayTexture||L.isCompressedArrayTexture?(T.setTexture2DArray(L,0),bt=U.TEXTURE_2D_ARRAY):(T.setTexture2D(L,0),bt=U.TEXTURE_2D),U.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,L.flipY),U.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,L.premultiplyAlpha),U.pixelStorei(U.UNPACK_ALIGNMENT,L.unpackAlignment);const Je=U.getParameter(U.UNPACK_ROW_LENGTH),Zt=U.getParameter(U.UNPACK_IMAGE_HEIGHT),ze=U.getParameter(U.UNPACK_SKIP_PIXELS),In=U.getParameter(U.UNPACK_SKIP_ROWS),Re=U.getParameter(U.UNPACK_SKIP_IMAGES);U.pixelStorei(U.UNPACK_ROW_LENGTH,ie.width),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,ie.height),U.pixelStorei(U.UNPACK_SKIP_PIXELS,St),U.pixelStorei(U.UNPACK_SKIP_ROWS,Pt),U.pixelStorei(U.UNPACK_SKIP_IMAGES,Ft);const ci=y.isDataArrayTexture||y.isData3DTexture,se=L.isDataArrayTexture||L.isData3DTexture;if(y.isRenderTargetTexture||y.isDepthTexture){const We=ut.get(y),hi=ut.get(L),Le=ut.get(We.__renderTarget),un=ut.get(hi.__renderTarget);ct.bindFramebuffer(U.READ_FRAMEBUFFER,Le.__webglFramebuffer),ct.bindFramebuffer(U.DRAW_FRAMEBUFFER,un.__webglFramebuffer);for(let dn=0;dn<yt;dn++)ci&&U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,ut.get(y).__webglTexture,F,Ft+dn),y.isDepthTexture?(se&&U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,ut.get(L).__webglTexture,F,ee+dn),U.blitFramebuffer(St,Pt,et,ft,Et,Kt,et,ft,U.DEPTH_BUFFER_BIT,U.NEAREST)):se?U.copyTexSubImage3D(bt,F,Et,Kt,ee+dn,St,Pt,et,ft):U.copyTexSubImage2D(bt,F,Et,Kt,ee+dn,St,Pt,et,ft);ct.bindFramebuffer(U.READ_FRAMEBUFFER,null),ct.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else se?y.isDataTexture||y.isData3DTexture?U.texSubImage3D(bt,F,Et,Kt,ee,et,ft,yt,Ae,jt,ie.data):L.isCompressedArrayTexture?U.compressedTexSubImage3D(bt,F,Et,Kt,ee,et,ft,yt,Ae,ie.data):U.texSubImage3D(bt,F,Et,Kt,ee,et,ft,yt,Ae,jt,ie):y.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,F,Et,Kt,et,ft,Ae,jt,ie.data):y.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,F,Et,Kt,ie.width,ie.height,Ae,ie.data):U.texSubImage2D(U.TEXTURE_2D,F,Et,Kt,et,ft,Ae,jt,ie);U.pixelStorei(U.UNPACK_ROW_LENGTH,Je),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,Zt),U.pixelStorei(U.UNPACK_SKIP_PIXELS,ze),U.pixelStorei(U.UNPACK_SKIP_ROWS,In),U.pixelStorei(U.UNPACK_SKIP_IMAGES,Re),F===0&&L.generateMipmaps&&U.generateMipmap(bt),ct.unbindTexture()},this.copyTextureToTexture3D=function(y,L,V=null,H=null,F=0){return y.isTexture!==!0&&(Ei("WebGLRenderer: copyTextureToTexture3D function signature has changed."),V=arguments[0]||null,H=arguments[1]||null,y=arguments[2],L=arguments[3],F=arguments[4]||0),Ei('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(y,L,V,H,F)},this.initRenderTarget=function(y){ut.get(y).__webglFramebuffer===void 0&&T.setupRenderTarget(y)},this.initTexture=function(y){y.isCubeTexture?T.setTextureCube(y,0):y.isData3DTexture?T.setTexture3D(y,0):y.isDataArrayTexture||y.isCompressedArrayTexture?T.setTexture2DArray(y,0):T.setTexture2D(y,0),ct.unbindTexture()},this.resetState=function(){A=0,R=0,P=null,ct.reset(),Yt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return 2e3}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=qt._getDrawingBufferColorSpace(t),e.unpackColorSpace=qt._getUnpackColorSpace()}}class Rf extends pe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ze,this.environmentIntensity=1,this.environmentRotation=new Ze,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class Cf{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=35044,this.updateRanges=[],this.version=0,this.uuid=Mn()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[n+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Mn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Mn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Ee=new N;class vs{constructor(t,e,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.applyMatrix4(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.applyNormalMatrix(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Ee.fromBufferAttribute(this,e),Ee.transformDirection(t),this.setXYZ(e,Ee.x,Ee.y,Ee.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=Ye(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Qt(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=Ye(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=Ye(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=Ye(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=Ye(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Qt(e,this.array),n=Qt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=Qt(e,this.array),n=Qt(n,this.array),s=Qt(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=Qt(e,this.array),n=Qt(n,this.array),s=Qt(s,this.array),r=Qt(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new ce(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new vs(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Ri extends Sn{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new gt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let Zn;const mi=new N,$n=new N,Jn=new N,Qn=new It,gi=new It,Oo=new ne,rs=new N,_i=new N,as=new N,Ga=new It,ar=new It,Va=new It;class Ms extends pe{constructor(t=new Ri){if(super(),this.isSprite=!0,this.type="Sprite",Zn===void 0){Zn=new he;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Cf(e,5);Zn.setIndex([0,1,2,0,2,3]),Zn.setAttribute("position",new vs(n,3,0,!1)),Zn.setAttribute("uv",new vs(n,2,3,!1))}this.geometry=Zn,this.material=t,this.center=new It(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),$n.setFromMatrixScale(this.matrixWorld),Oo.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),Jn.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&$n.multiplyScalar(-Jn.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const a=this.center;os(rs.set(-.5,-.5,0),Jn,a,$n,s,r),os(_i.set(.5,-.5,0),Jn,a,$n,s,r),os(as.set(.5,.5,0),Jn,a,$n,s,r),Ga.set(0,0),ar.set(1,0),Va.set(1,1);let o=t.ray.intersectTriangle(rs,_i,as,!1,mi);if(o===null&&(os(_i.set(-.5,.5,0),Jn,a,$n,s,r),ar.set(0,1),o=t.ray.intersectTriangle(rs,as,_i,!1,mi),o===null))return;const l=t.ray.origin.distanceTo(mi);l<t.near||l>t.far||e.push({distance:l,point:mi.clone(),uv:Ie.getInterpolation(mi,rs,_i,as,Ga,ar,Va,new It),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function os(i,t,e,n,s,r){Qn.subVectors(i,e).addScalar(.5).multiply(n),s!==void 0?(gi.x=r*Qn.x-s*Qn.y,gi.y=s*Qn.x+r*Qn.y):gi.copy(Qn),i.copy(t),i.x+=gi.x,i.y+=gi.y,i.applyMatrix4(Oo)}class cn extends Sn{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new gt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const ys=new N,Ss=new N,Ha=new ne,xi=new As,ls=new Ui,or=new N,ka=new N;class Ci extends pe{constructor(t=new he,e=new cn){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)ys.fromBufferAttribute(e,s-1),Ss.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=ys.distanceTo(Ss);t.setAttribute("lineDistance",new ue(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ls.copy(n.boundingSphere),ls.applyMatrix4(s),ls.radius+=r,t.ray.intersectsSphere(ls)===!1)return;Ha.copy(s).invert(),xi.copy(t.ray).applyMatrix4(Ha);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,h=this.isLineSegments?2:1,u=n.index,d=n.attributes.position;if(u!==null){const m=Math.max(0,a.start),_=Math.min(u.count,a.start+a.count);for(let g=m,f=_-1;g<f;g+=h){const c=u.getX(g),b=u.getX(g+1),E=cs(this,t,xi,l,c,b);E&&e.push(E)}if(this.isLineLoop){const g=u.getX(_-1),f=u.getX(m),c=cs(this,t,xi,l,g,f);c&&e.push(c)}}else{const m=Math.max(0,a.start),_=Math.min(d.count,a.start+a.count);for(let g=m,f=_-1;g<f;g+=h){const c=cs(this,t,xi,l,g,g+1);c&&e.push(c)}if(this.isLineLoop){const g=cs(this,t,xi,l,_-1,m);g&&e.push(g)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function cs(i,t,e,n,s,r){const a=i.geometry.attributes.position;if(ys.fromBufferAttribute(a,s),Ss.fromBufferAttribute(a,r),e.distanceSqToSegment(ys,Ss,or,ka)>n)return;or.applyMatrix4(i.matrixWorld);const l=t.ray.origin.distanceTo(or);if(!(l<t.near||l>t.far))return{distance:l,point:ka.clone().applyMatrix4(i.matrixWorld),index:s,face:null,faceIndex:null,barycoord:null,object:i}}const Wa=new N,Xa=new N;class _r extends Ci{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[];for(let s=0,r=e.count;s<r;s+=2)Wa.fromBufferAttribute(e,s),Xa.fromBufferAttribute(e,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+Wa.distanceTo(Xa);t.setAttribute("lineDistance",new ue(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Pf extends Ci{constructor(t,e){super(t,e),this.isLineLoop=!0,this.type="LineLoop"}}class wr extends Sn{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new gt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const qa=new ne,xr=new As,hs=new Ui,us=new N;class zo extends pe{constructor(t=new he,e=new wr){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),hs.copy(n.boundingSphere),hs.applyMatrix4(s),hs.radius+=r,t.ray.intersectsSphere(hs)===!1)return;qa.copy(s).invert(),xr.copy(t.ray).applyMatrix4(qa);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,h=n.index,p=n.attributes.position;if(h!==null){const d=Math.max(0,a.start),m=Math.min(h.count,a.start+a.count);for(let _=d,g=m;_<g;_++){const f=h.getX(_);us.fromBufferAttribute(p,f),Ya(us,f,l,s,t,e,this)}}else{const d=Math.max(0,a.start),m=Math.min(p.count,a.start+a.count);for(let _=d,g=m;_<g;_++)us.fromBufferAttribute(p,_),Ya(us,_,l,s,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Ya(i,t,e,n,s,r,a){const o=xr.distanceSqToPoint(i);if(o<e){const l=new N;xr.closestPointToPoint(i,l),l.applyMatrix4(n);const h=s.ray.origin.distanceTo(l);if(h<s.near||h>s.far)return;r.push({distance:h,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}class Go extends ye{constructor(t,e,n,s,r,a,o,l,h){super(t,e,n,s,r,a,o,l,h),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Rr extends he{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);const r=[],a=[],o=[],l=[],h=new N,u=new It;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let p=0,d=3;p<=e;p++,d+=3){const m=n+p/e*s;h.x=t*Math.cos(m),h.y=t*Math.sin(m),a.push(h.x,h.y,h.z),o.push(0,0,1),u.x=(a[d]/t+1)/2,u.y=(a[d+1]/t+1)/2,l.push(u.x,u.y)}for(let p=1;p<=e;p++)r.push(p,p+1,0);this.setIndex(r),this.setAttribute("position",new ue(a,3)),this.setAttribute("normal",new ue(o,3)),this.setAttribute("uv",new ue(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Rr(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class Cr extends he{constructor(t=1,e=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const h=this;s=Math.floor(s),r=Math.floor(r);const u=[],p=[],d=[],m=[];let _=0;const g=[],f=n/2;let c=0;b(),a===!1&&(t>0&&E(!0),e>0&&E(!1)),this.setIndex(u),this.setAttribute("position",new ue(p,3)),this.setAttribute("normal",new ue(d,3)),this.setAttribute("uv",new ue(m,2));function b(){const M=new N,C=new N;let A=0;const R=(e-t)/n;for(let P=0;P<=r;P++){const S=[],x=P/r,w=x*(e-t)+t;for(let I=0;I<=s;I++){const B=I/s,O=B*l+o,G=Math.sin(O),W=Math.cos(O);C.x=w*G,C.y=-x*n+f,C.z=w*W,p.push(C.x,C.y,C.z),M.set(G,R,W).normalize(),d.push(M.x,M.y,M.z),m.push(B,1-x),S.push(_++)}g.push(S)}for(let P=0;P<s;P++)for(let S=0;S<r;S++){const x=g[S][P],w=g[S+1][P],I=g[S+1][P+1],B=g[S][P+1];(t>0||S!==0)&&(u.push(x,w,B),A+=3),(e>0||S!==r-1)&&(u.push(w,I,B),A+=3)}h.addGroup(c,A,0),c+=A}function E(M){const C=_,A=new It,R=new N;let P=0;const S=M===!0?t:e,x=M===!0?1:-1;for(let I=1;I<=s;I++)p.push(0,f*x,0),d.push(0,x,0),m.push(.5,.5),_++;const w=_;for(let I=0;I<=s;I++){const O=I/s*l+o,G=Math.cos(O),W=Math.sin(O);R.x=S*W,R.y=f*x,R.z=S*G,p.push(R.x,R.y,R.z),d.push(0,x,0),A.x=G*.5+.5,A.y=W*.5*x+.5,m.push(A.x,A.y),_++}for(let I=0;I<s;I++){const B=C+I,O=w+I;M===!0?u.push(O,O+1,B):u.push(O+1,O,B),P+=3}h.addGroup(c,P,M===!0?1:2),c+=P}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Cr(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Pr extends Cr{constructor(t=1,e=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new Pr(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Ni extends he{constructor(t=.5,e=1,n=32,s=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:s,thetaStart:r,thetaLength:a},n=Math.max(3,n),s=Math.max(1,s);const o=[],l=[],h=[],u=[];let p=t;const d=(e-t)/s,m=new N,_=new It;for(let g=0;g<=s;g++){for(let f=0;f<=n;f++){const c=r+f/n*a;m.x=p*Math.cos(c),m.y=p*Math.sin(c),l.push(m.x,m.y,m.z),h.push(0,0,1),_.x=(m.x/e+1)/2,_.y=(m.y/e+1)/2,u.push(_.x,_.y)}p+=d}for(let g=0;g<s;g++){const f=g*(n+1);for(let c=0;c<n;c++){const b=c+f,E=b,M=b+n+1,C=b+n+2,A=b+1;o.push(E,M,A),o.push(M,C,A)}}this.setIndex(o),this.setAttribute("position",new ue(l,3)),this.setAttribute("normal",new ue(h,3)),this.setAttribute("uv",new ue(u,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ni(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class ke extends he{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let h=0;const u=[],p=new N,d=new N,m=[],_=[],g=[],f=[];for(let c=0;c<=n;c++){const b=[],E=c/n;let M=0;c===0&&a===0?M=.5/e:c===n&&l===Math.PI&&(M=-.5/e);for(let C=0;C<=e;C++){const A=C/e;p.x=-t*Math.cos(s+A*r)*Math.sin(a+E*o),p.y=t*Math.cos(a+E*o),p.z=t*Math.sin(s+A*r)*Math.sin(a+E*o),_.push(p.x,p.y,p.z),d.copy(p).normalize(),g.push(d.x,d.y,d.z),f.push(A+M,1-E),b.push(h++)}u.push(b)}for(let c=0;c<n;c++)for(let b=0;b<e;b++){const E=u[c][b+1],M=u[c][b],C=u[c+1][b],A=u[c+1][b+1];(c!==0||a>0)&&m.push(E,M,A),(c!==n-1||l<Math.PI)&&m.push(M,C,A)}this.setIndex(m),this.setAttribute("position",new ue(_,3)),this.setAttribute("normal",new ue(g,3)),this.setAttribute("uv",new ue(f,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ke(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Ka extends Sn{static get type(){return"MeshPhongMaterial"}constructor(t){super(),this.isMeshPhongMaterial=!0,this.color=new gt(16777215),this.specular=new gt(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new gt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new It(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ze,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.specular.copy(t.specular),this.shininess=t.shininess,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class ja extends cn{static get type(){return"LineDashedMaterial"}constructor(t){super(),this.isLineDashedMaterial=!0,this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}}const Za={enabled:!1,files:{},add:function(i,t){this.enabled!==!1&&(this.files[i]=t)},get:function(i){if(this.enabled!==!1)return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};class Df{constructor(t,e,n){const s=this;let r=!1,a=0,o=0,l;const h=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(u){o++,r===!1&&s.onStart!==void 0&&s.onStart(u,a,o),r=!0},this.itemEnd=function(u){a++,s.onProgress!==void 0&&s.onProgress(u,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(u){s.onError!==void 0&&s.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,p){return h.push(u,p),this},this.removeHandler=function(u){const p=h.indexOf(u);return p!==-1&&h.splice(p,2),this},this.getHandler=function(u){for(let p=0,d=h.length;p<d;p+=2){const m=h[p],_=h[p+1];if(m.global&&(m.lastIndex=0),m.test(u))return _}return null}}}const Lf=new Df;class Dr{constructor(t){this.manager=t!==void 0?t:Lf,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){const n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}}Dr.DEFAULT_MATERIAL_NAME="__DEFAULT";class Uf extends Dr{constructor(t){super(t)}load(t,e,n,s){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const r=this,a=Za.get(t);if(a!==void 0)return r.manager.itemStart(t),setTimeout(function(){e&&e(a),r.manager.itemEnd(t)},0),a;const o=wi("img");function l(){u(),Za.add(t,this),e&&e(this),r.manager.itemEnd(t)}function h(p){u(),s&&s(p),r.manager.itemError(t),r.manager.itemEnd(t)}function u(){o.removeEventListener("load",l,!1),o.removeEventListener("error",h,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",h,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),r.manager.itemStart(t),o.src=t,o}}class Ff extends Dr{constructor(t){super(t)}load(t,e,n,s){const r=new ye,a=new Uf(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(t,function(o){r.image=o,r.needsUpdate=!0,e!==void 0&&e(r)},n,s),r}}class Vo extends pe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new gt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}const lr=new ne,$a=new N,Ja=new N;class Nf{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new It(512,512),this.map=null,this.mapPass=null,this.matrix=new ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Tr,this._frameExtents=new It(1,1),this._viewportCount=1,this._viewports=[new oe(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;$a.setFromMatrixPosition(t.matrixWorld),e.position.copy($a),Ja.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ja),e.updateMatrixWorld(),lr.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(lr),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(lr)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class If extends Nf{constructor(){super(new Lo(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Bf extends Vo{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(pe.DEFAULT_UP),this.updateMatrix(),this.target=new pe,this.shadow=new If}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class Of extends Vo{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}const Qa=new ne;class zf{constructor(t,e,n=0,s=1/0){this.ray=new As(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new br,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return Qa.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Qa),this}intersectObject(t,e=!0,n=[]){return vr(t,this,n,e),n.sort(to),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)vr(t[s],this,n,e);return n.sort(to),n}}function to(i,t){return i.distance-t.distance}function vr(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let a=0,o=r.length;a<o;a++)vr(r[a],t,e,!0)}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"170"}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="170");function ht(i,t,e){return Number.isFinite(i)?i<t?t:i>e?e:i:t}function rn(i,t,e){return i+(t-i)*ht(e,0,1)}const Xe=(i=0,t=0,e=0)=>({x:i,y:t,z:e});function Gf(i,t){return{x:i.x-t.x,y:i.y-t.y,z:i.z-t.z}}function Ho(i){return Math.hypot(i.x,i.y,i.z)}function Vf(i,t){return Math.hypot(i.x-t.x,i.y-t.y,i.z-t.z)}function ko(i){const t=Ho(i);return t>1e-12?{x:i.x/t,y:i.y/t,z:i.z/t}:Xe(0,0,0)}function Hf(i,t){return{x:(i.x+t.x)*.5,y:(i.y+t.y)*.5,z:(i.z+t.z)*.5}}function kf(i){return!!i&&Number.isFinite(i.x)&&Number.isFinite(i.y)&&Number.isFinite(i.z)}function Wo(i,t){if(!i||i.length===0)return[];const e=Math.max(2,Math.floor(Number.isFinite(t)?t:2));if(i.length<=e)return i;const n=[],s=(i.length-1)/(e-1);for(let r=0;r<e;r++){const a=Math.min(i.length-1,Math.max(0,Math.round(r*s)));n.push(i[a])}return n}function Wf(i,t,e){if(!i||!e||t<=0)return;e[0]=0;let n=0;for(let s=1;s<t;s++){const r=s*3,a=r-3,o=i[r]-i[a],l=i[r+1]-i[a+1],h=i[r+2]-i[a+2];n+=Math.hypot(o,l,h),e[s]=n}}function Xo(){return{valid:!1,center:Xe(0,0,0),normal:Xe(0,1,0),radiusAU:0,thicknessAU:0,samples:0}}function Xf(i,t=512){const e=Xo();if(!i||i.length<3)return e;const n=Wo(i,Math.max(3,Math.floor(t))),s=[];for(let C=0;C<n.length;C++){const A=n[C];kf(A)&&s.push(A)}if(s.length<3)return e;let r=0,a=0,o=0;for(let C=0;C<s.length;C++)r+=s[C].x,a+=s[C].y,o+=s[C].z;const l=1/s.length;r*=l,a*=l,o*=l;let h=0,u=0,p=0,d=0;for(let C=0;C<s.length;C++){const A=s[C],R=s[(C+1)%s.length];h+=(A.y-R.y)*(A.z+R.z),u+=(A.z-R.z)*(A.x+R.x),p+=(A.x-R.x)*(A.y+R.y);const P=A.x-r,S=A.y-a,x=A.z-o,w=P*P+S*S+x*x;w>d&&(d=w)}let m=Math.hypot(h,u,p);const _=Math.max(1e-14,d*1e-6);if(!(m>_)){let C=0,A=0,R=0,P=0;for(let S=0;S<s.length;S++){const x=s[S],w=s[(S+1)%s.length],I=x.x-r,B=x.y-a,O=x.z-o,G=w.x-r,W=w.y-a,Z=w.z-o,k=B*Z-O*W,tt=O*G-I*Z,lt=I*W-B*G,vt=Math.hypot(k,tt,lt);vt>P&&(P=vt,C=k,A=tt,R=lt)}if(!(P>0))return e;h=C,u=A,p=R,m=P}h/=m,u/=m,p/=m;const g=Math.abs(h),f=Math.abs(u),c=Math.abs(p);(g>=f&&g>=c?h:f>=c?u:p)<0&&(h=-h,u=-u,p=-p);let E=0,M=0;for(let C=0;C<s.length;C++){const A=s[C],R=A.x-r,P=A.y-a,S=A.z-o,x=R*h+P*u+S*p,w=R*R+P*P+S*S,I=Math.sqrt(Math.max(0,w-x*x));I>E&&(E=I);const B=Math.abs(x);B>M&&(M=B)}return E>1e-9&&(e.valid=!0,e.center={x:r,y:a,z:o},e.normal={x:h,y:u,z:p},e.radiusAU=E,e.thicknessAU=M,e.samples=s.length),e}const ds=new N,eo=new N;function ei(i,t,e,n,s){const r=s??{x:0,y:0,depth:0,visible:!1};ds.set(t.x,t.y,t.z).project(i);const a=ds.x,o=ds.y,l=ds.z;return r.x=(a*.5+.5)*e,r.y=(-o*.5+.5)*n,r.depth=l,r.visible=Number.isFinite(a)&&Number.isFinite(o)&&Number.isFinite(l)&&l>-1&&l<1&&a>=-1&&a<=1&&o>=-1&&o<=1,r}function qo(i,t,e){const n=Math.max(2,Number.isFinite(e)?e:2);eo.set(t.x,t.y,t.z);const s=Math.max(1e-6,i.position.distanceTo(eo)),r=i.fov*Math.PI/180,a=Math.max(1e-6,Math.tan(r*.5));return n/(2*s*a)}const Lr=1495978707e-1,no=.00465047,qf=Math.PI*2,Gt={void:"#02050b",voidCenter:"#071523",accent:"#3fd0ff",accentDim:"#2b93bb",warm:"#ffc857",danger:"#ff5b6e",ok:"#4ef2b0",text:"#d7e9f8",muted:"#7d96ad",grid:"#2f6d8d",axisX:"#ff8a7a",axisY:"#7cf0a8",axisZ:"#6fb8ff",planet:"#7fe0c8",planetCold:"#9cc4e0",planetHot:"#e0a070",orbitPlane:"#3a90b8",selection:"#8fe8ff",distance:"#9fd8ff",uncertainty:"#4fa8ff",pulse:"#ff7a5b"},Cs={mono:'"JetBrains Mono", "Cascadia Mono", Consolas, "SFMono-Regular", "Microsoft YaHei", monospace',ui:'"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif'},Yf={A:"#ffcf8a",B:"#9fd8ff",C:"#ff9fb8",planet:Gt.planet};function cr(i,t=3){if(!Number.isFinite(i))return"—";if(i===0)return"0";const e=Math.abs(i);if(e>=1e6||e<.001)return i.toExponential(Math.max(0,t-1)).replace("e+","e");const n=i.toPrecision(t);return n.includes(".")?n.replace(/0+$/,"").replace(/\.$/,""):n}function je(i){if(!Number.isFinite(i)||i<0)return"—";if(i>=.01)return cr(i,3)+" AU";const t=i*Lr;return t>=1e4?cr(t/1e4,3)+" 万 km":t>=1?Math.round(t)+" km":cr(t,2)+" km"}function ri(i){if(!Number.isFinite(i))return"h=—";const t=Math.abs(i)<5e-4?0:i,e=Math.abs(t),n=e>=.01?e.toFixed(2):e>=.001?e.toFixed(3):e.toFixed(4);return"h="+(t<0?"−":"+")+n+" AU"}function Kf(i){if(!Number.isFinite(i))return"Δh=—";const t=Math.abs(i),e=t>=.01?t.toFixed(2):t>=.001?t.toFixed(3):t.toFixed(4);return"Δh="+(i<0?"−":"+")+e+" AU"}function Ii(i){return!Number.isFinite(i)||i<=0?"—":"σ±"+je(i)}function Yo(i){return i==null||!Number.isFinite(i)?"温度未知":(i>=0?"+":"−")+Math.abs(i).toFixed(1)+" °C"}function Ko(i){return i==null||!Number.isFinite(i)?"—":Math.round(i)+" K"}function jo(i){return i==null||!Number.isFinite(i)?"宜居度未知":"宜居度 "+(ht(i,0,1)*100).toFixed(0)+"%"}function Zo(i){return i==null||!Number.isFinite(i)?"—":i.toFixed(2)+" M☉"}function $o(i){return i==null||!Number.isFinite(i)?"—":"置信度 "+(ht(i,0,1)*100).toFixed(0)+"%"}function Ur(i){return i==null||!Number.isFinite(i)||i<=0?"—":Math.round(i).toLocaleString("en-US")+" km"}function Mr(i){if(!Number.isFinite(i)||i<=0)return 1;const t=Math.floor(Math.log10(i)),e=Math.pow(10,t),n=i/e;return(n<1.5?1:n<3.5?2:n<7.5?5:10)*e}const Ti=new Map;function Es(i){const t=typeof i=="string"?i:"",e=Ti.get(t);if(e)return e;let n={r:200,g:220,b:255};const s=t.trim();if(s.charCodeAt(0)===35)s.length===4?n={r:parseInt(s[1]+s[1],16),g:parseInt(s[2]+s[2],16),b:parseInt(s[3]+s[3],16)}:s.length>=7&&(n={r:parseInt(s.slice(1,3),16),g:parseInt(s.slice(3,5),16),b:parseInt(s.slice(5,7),16)});else if(s.startsWith("rgb")){const r=s.match(/-?\d+(?:\.\d+)?/g);r&&r.length>=3&&(n={r:Number(r[0]),g:Number(r[1]),b:Number(r[2])})}return Number.isFinite(n.r)||(n.r=200),Number.isFinite(n.g)||(n.g=220),Number.isFinite(n.b)||(n.b=255),n={r:ht(Math.round(n.r),0,255),g:ht(Math.round(n.g),0,255),b:ht(Math.round(n.b),0,255)},Ti.size>512&&Ti.clear(),Ti.set(t,n),n}function hr(i){const t=ht(Math.round(i),0,255).toString(16);return t.length===1?"0"+t:t}function Jo(i){return"#"+hr(i.r)+hr(i.g)+hr(i.b)}function hn(i,t=Gt.accent){if(typeof i!="string"||i.trim().length===0)return t;const e=i.trim();return e.charCodeAt(0)===35||e.startsWith("rgb")?Jo(Es(e)):t}function Ne(i,t){const e=Es(i);return"rgba("+e.r+","+e.g+","+e.b+","+ht(t,0,1)+")"}function yn(i,t,e){const n=Es(i),s=Es(t),r=ht(e,0,1);return Jo({r:n.r+(s.r-n.r)*r,g:n.g+(s.g-n.g)*r,b:n.b+(s.b-n.b)*r})}function on(i,t){return yn(i,"#ffffff",t)}const vi=[[1800,"#ff5a2b"],[2600,"#ff7b3d"],[3600,"#ffa25c"],[4600,"#ffcf9a"],[5800,"#fff3dd"],[7e3,"#eef4ff"],[9e3,"#d7e6ff"],[13e3,"#bcd3ff"],[22e3,"#a8c4ff"],[4e4,"#9db8ff"]];function jf(i){const t=ht(Number.isFinite(i)?i:5800,1800,4e4);for(let e=1;e<vi.length;e++){const[n,s]=vi[e];if(t<=n){const[r,a]=vi[e-1];return yn(a,s,(t-r)/(n-r))}}return vi[vi.length-1][1]}function Qo(i){if(!i)return Gt.accent;const t=String(i);return Yf[t]??Gt.accent}function bs(i){if(typeof i!="string"||i.length===0)return"";let t=i;if(t.startsWith("plane:")&&(t=t.slice(6)),t.startsWith("obs-"))t=t.slice(4);else if(t.startsWith("pred-cloud-"))t=t.slice(11);else if(t.startsWith("pred-sigma-"))t=t.slice(11);else if(t.startsWith("pred-"))t=t.slice(5);else if(t.startsWith("sigma-"))t=t.slice(6);else if(t.startsWith("hazard-"))return"";if(t==="planet"||t==="A"||t==="B"||t==="C")return t;const e=t.split("-")[0];return e==="A"||e==="B"||e==="C"||e==="planet"?e:t}function tl(i,t){const e=hn(t,"");return e.length>0?e:Qo(bs(i))}function Zf(i){const t=ht(Number.isFinite(i)?i:0,0,1);return t>=.7?Gt.danger:t>=.35?Gt.warm:Gt.accent}function el(i){let t=2166136261;const e=String(i);for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return t^=t>>>16,t=Math.imul(t,2246822507),t^=t>>>13,t>>>0}function $f(i,t=0){return el(i+"#"+t)/4294967296}function Jf(i){let t=i>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const vn=new Map;let Un=null;const Qf=64;function Fr(i){if(typeof document>"u"||typeof document.createElement!="function")return null;try{const t=document.createElement("canvas");return t.width=Math.max(1,Math.floor(i)),t.height=Math.max(1,Math.floor(i)),t}catch{return null}}function Nr(i){try{return i.getContext("2d")}catch{return null}}function Ir(i){try{const t=new Go(i);return t.colorSpace=Te,t.needsUpdate=!0,t}catch{return null}}function ii(i){const t=hn(i),e=vn.get(t);if(e)return e;const n=Fr(128),s=n?Nr(n):null;if(!n||!s)return null;const r=64,a=s.createRadialGradient(r,r,0,r,r,r);a.addColorStop(0,"rgba(255,255,255,1)"),a.addColorStop(.05,Ne(t,.98)),a.addColorStop(.12,Ne(t,.86)),a.addColorStop(.24,Ne(t,.44)),a.addColorStop(.44,Ne(t,.15)),a.addColorStop(.68,Ne(t,.04)),a.addColorStop(1,Ne(t,0)),s.fillStyle=a,s.fillRect(0,0,128,128);const o=Ir(n);if(!o)return null;if(vn.size>=Qf){const l=vn.keys().next().value;if(l!==void 0){const h=vn.get(l);vn.delete(l);try{h?.dispose()}catch{}}}return vn.set(t,o),o}function nl(){if(Un)return Un;const i=Fr(64),t=i?Nr(i):null;if(!i||!t)return null;const e=32,n=t.createRadialGradient(e,e,0,e,e,e);return n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.22,"rgba(255,255,255,0.82)"),n.addColorStop(.45,"rgba(255,255,255,0.28)"),n.addColorStop(.72,"rgba(255,255,255,0.05)"),n.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=n,t.fillRect(0,0,64,64),Un=Ir(i),Un}function tp(){const i=Fr(512),t=i?Nr(i):null;if(!i||!t)return null;const e=256,n=t.createRadialGradient(e,e,0,e,e,e*1.42);return n.addColorStop(0,"#081827"),n.addColorStop(.32,"#04101c"),n.addColorStop(.62,"#020a12"),n.addColorStop(.86,"#01060c"),n.addColorStop(1,Gt.void),t.fillStyle=n,t.fillRect(0,0,512,512),Ir(i)}function ep(){if(vn.forEach(i=>{try{i.dispose()}catch{}}),vn.clear(),Un){try{Un.dispose()}catch{}Un=null}Ti.clear()}const np=3.3,ip=1.55,sp=9;function rp(i,t){return(Number.isFinite(t)&&t>1e-6?t:3)*(i==="planet"?.02:.022)}function ap(i,t,e,n){const s=Number.isFinite(n)?n:1.02,r=Number.isFinite(e)?e:.86;if(t!=="planet")return{theta:r+.42,phi:Math.min(2.35,Math.max(.62,s*.72+.34))};const a=i?.planet,o=i?.stars??[];if(!a||!Ke(a.pos))return{theta:r+.5,phi:1.18};const l=il(o,a.pos);if(!l)return{theta:r+.5,phi:1.18};const h=l.pos.x-a.pos.x,u=l.pos.y-a.pos.y,p=l.pos.z-a.pos.z,d=Math.hypot(h,u,p);if(!(d>1e-9))return{theta:r+.5,phi:1.18};const m=h/d,_=u/d,g=p/d,f=Math.atan2(m,g)+.66,c=Math.min(2.3,Math.max(.45,Math.acos(Math.max(-.92,Math.min(.92,_)))+.36));return{theta:f,phi:c}}function il(i,t){let e=null,n=1/0;for(let s=0;s<i.length;s++){const r=i[s];if(!r||!Ke(r.pos))continue;const a=r.pos.x-t.x,o=r.pos.y-t.y,l=r.pos.z-t.z,h=a*a+o*o+l*l;h<n&&(n=h,e=r)}return e}function op(i){return i==null||!Number.isFinite(i)||i<=0?null:i<3700?"M 型 · 红矮/红巨星":i<5200?"K 型 · 橙色":i<6e3?"G 型 · 黄色（类太阳）":i<7500?"F 型 · 黄白":i<1e4?"A 型 · 蓝白":"B/O 型 · 高温蓝白"}function lp(i,t,e){if(!i)return null;if(t==="planet"){const l=i.planet;return l?cp(l,i,e):null}const n=up(i,t);if(!n)return null;const s=[],r=!!n.known,a=op(n.tempK);s.push({label:"观测置信度",value:r?$o(n.confidence):"仅确认存在",tone:r?"ink":"warn"}),s.push({label:"光谱类型（按观测温度）",value:a??"温度未测",tone:a?"ink":"warn"}),s.push({label:"表面温度",value:Ko(n.tempK),tone:n.tempK===null?"warn":"ink"}),s.push({label:"恒星质量",value:Zo(n.mass),tone:n.mass===null?"warn":"ink"}),s.push({label:"估计半径",value:Number.isFinite(n.radiusAU)&&n.radiusAU>0?Ur(n.radiusAU*Lr):"—",tone:Number.isFinite(n.radiusAU)&&n.radiusAU>0?"muted":"warn"}),s.push({label:"位置不确定度",value:Ii(n.sigmaAU),tone:n.sigmaAU>0?"muted":"warn"}),s.push({label:"距系统原点",value:Ke(n.pos)?je(Math.hypot(n.pos.x,n.pos.y,n.pos.z)):"—"}),i.planet&&Ke(i.planet.pos)&&Ke(n.pos)&&s.push({label:"相对母星",value:je(sl(n.pos,i.planet.pos)),tone:"muted"}),e&&Ke(n.pos)&&s.push({label:"高度 Y（三维观测）",value:ri(n.pos.y),tone:"muted"});const o=r?null:"该恒星仅确认存在：位置与物理参数尚未测定，近景表面为程序化占位材质。";return{id:t,kind:"star",title:n.name||"恒星 "+t,subtitle:"恒星 · "+(a??"光谱未测")+(r?"":" · 未定位"),accent:n.color,rows:s,warning:o}}function cp(i,t,e){const n=[{label:"天体类型",value:"类地行星 · 母星"},{label:"表面温度",value:Yo(i.tempC),tone:i.tempC===null?"warn":"ink"},{label:"宜居度（观测估计）",value:jo(i.habitability),tone:i.habitability===null?"warn":"ok"},{label:"估计半径",value:Number.isFinite(i.radiusKm)&&i.radiusKm>0?Ur(i.radiusKm):"—",tone:Number.isFinite(i.radiusKm)&&i.radiusKm>0?"muted":"warn"},{label:"位置不确定度",value:Ii(i.sigmaAU),tone:i.sigmaAU>0?"muted":"warn"},{label:"距系统原点",value:Ke(i.pos)?je(Math.hypot(i.pos.x,i.pos.y,i.pos.z)):"—"}],s=il(t.stars??[],i.pos);s&&Ke(s.pos)&&Ke(i.pos)&&n.push({label:"距最近恒星",value:je(sl(i.pos,s.pos)),tone:"muted"}),e&&Ke(i.pos)&&n.push({label:"高度 Y（三维观测）",value:ri(i.pos.y),tone:"muted"});const r=[];return i.tempC===null&&r.push("温度"),i.habitability===null&&r.push("宜居度"),{id:"planet",kind:"planet",title:"母星",subtitle:"类地行星 · 母星 · 观测档案",accent:"#7fe0c8",rows:n,warning:r.length>0?"观测缺口："+r.join("、")+" 尚未测定（信息卡只显示观测数据）。":null}}const hp=[{id:"A",label:"恒星 A"},{id:"B",label:"恒星 B"},{id:"C",label:"恒星 C"},{id:"planet",label:"母星"}];function up(i,t){for(let e=0;e<i.stars.length;e++){const n=i.stars[e];if(n&&n.id===t)return n}return null}function sl(i,t){return Math.hypot(i.x-t.x,i.y-t.y,i.z-t.z)}function Ke(i){return!!i&&Number.isFinite(i.x)&&Number.isFinite(i.y)&&Number.isFinite(i.z)}const io=45,Mi=.86,yi=1.02,Si=2.2,dp=.06,fp=9,pp=.07,mp=Math.PI-.07,gp=.085,_p=5,fs=.85;function xp(i){const t=ht(i,0,1);return 1-Math.pow(1-t,3)}class vp{camera;target=new N;baseRadius=3;minDistance=.18;maxDistance=27;theta=Mi;goalTheta=Mi;phi=yi;goalPhi=yi;distance=Si*3;goalDistance=Si*3;goalTarget=new N;viewportWidth=640;viewportHeight=360;lastNear=-1;lastFar=-1;moving=!1;tmpRight=new N;tmpUp=new N;mode="orbit";nearRadius=0;savedPose=null;tween=null;constructor(){this.camera=new Fe(io,16/9,.01,200),this.goalTarget.set(0,0,0),this.applyPosition(!0)}get viewRadius(){return this.baseRadius}get cameraDistance(){return this.distance}get isMoving(){return this.moving}get isNear(){return this.mode==="near"}get isTransitioning(){return this.tween!==null}get zoomRange(){return{min:this.minDistance,max:this.maxDistance,current:this.distance}}get presetOrientation(){return{theta:this.goalTheta,phi:this.goalPhi}}setViewport(t,e){this.viewportWidth=Math.max(2,Math.floor(Number.isFinite(t)?t:2)),this.viewportHeight=Math.max(2,Math.floor(Number.isFinite(e)?e:2)),this.camera.aspect=this.viewportWidth/this.viewportHeight,this.camera.updateProjectionMatrix()}setBaseRadius(t){const e=Number.isFinite(t)&&t>1e-6?t:this.baseRadius;if(Math.abs(e-this.baseRadius)>Math.max(1e-5,this.baseRadius*.001)){const n=e/this.baseRadius;this.baseRadius=e,this.mode==="orbit"&&(this.applyZoomLimits(),this.distance=ht(this.distance*n,this.minDistance,this.maxDistance),this.goalDistance=ht(this.goalDistance*n,this.minDistance,this.maxDistance))}this.applyPosition(!1)}update(t){const e=ht(Number.isFinite(t)?t:.016,0,.1);if(this.tween){const s=this.tween;s.progress=ht(s.progress+e/Math.max(.05,s.duration),0,1);const r=xp(s.progress);this.theta=rn(s.from.theta,s.to.theta,r),this.phi=rn(s.from.phi,s.to.phi,r),this.distance=rn(s.from.distance,s.to.distance,r),this.target.set(rn(s.from.tx,s.to.tx,r),rn(s.from.ty,s.to.ty,r),rn(s.from.tz,s.to.tz,r)),this.moving=!0,s.progress>=1&&(this.tween=null,this.theta=s.to.theta,this.phi=s.to.phi,this.distance=s.to.distance,this.target.set(s.to.tx,s.to.ty,s.to.tz)),this.applyPosition(!1);return}const n=e>0?1-Math.exp(-15*e):1;this.theta=rn(this.theta,this.goalTheta,n),this.phi=rn(this.phi,this.goalPhi,n),this.distance=rn(this.distance,this.goalDistance,n),this.target.lerp(this.goalTarget,n),this.moving=Math.abs(this.goalTheta-this.theta)>1e-4||Math.abs(this.goalPhi-this.phi)>1e-4||Math.abs(this.goalDistance-this.distance)>Math.max(1e-5,this.distance*1e-4)||this.target.distanceToSquared(this.goalTarget)>Math.max(1e-10,this.baseRadius*this.baseRadius*1e-8),this.applyPosition(!1)}enterNear(t,e,n,s=fs){if(!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.z))return;const r=Number.isFinite(e)&&e>1e-9?e:Math.max(1e-4,this.baseRadius*.02);if(this.mode==="near"){this.nearRadius=r,this.applyZoomLimits(),this.cancelTweenIntoGoals(),this.startTween(this.composeNearPose(t,r,n),this.clampDuration(s));return}this.savedPose=this.currentPose(),this.mode="near",this.nearRadius=r,this.applyZoomLimits(),this.startTween(this.composeNearPose(t,r,n),this.clampDuration(s))}setNearSurfaceRadius(t){if(this.mode!=="near")return;const e=Number.isFinite(t)&&t>1e-9?t:this.nearRadius;if(!(e>0))return;const n=e/Math.max(1e-9,this.nearRadius);this.nearRadius=e,this.applyZoomLimits(),Math.abs(n-1)>.001&&(this.goalDistance=ht(this.goalDistance*n,this.minDistance,this.maxDistance))}trackNearTarget(t){this.mode!=="near"||this.tween||!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.z)||this.goalTarget.set(t.x,t.y,t.z)}exitNear(t=fs){if(this.mode!=="near")return!1;const e=this.savedPose??this.defaultPose();return this.mode="orbit",this.savedPose=null,this.nearRadius=0,this.applyZoomLimits(),this.startTween(e,this.clampDuration(t)),!0}clearNearState(){this.mode="orbit",this.savedPose=null,this.nearRadius=0,this.tween=null,this.applyZoomLimits()}rotateByPixels(t,e){if(!Number.isFinite(t)||!Number.isFinite(e))return;this.cancelTweenIntoGoals();const n=this.goalTheta-t*.0055,s=ht(this.goalPhi-e*.0055,pp,mp);this.goalTheta=n,this.goalPhi=s,this.theta=n,this.phi=s,this.applyPosition(!1)}panByPixels(t,e){if(!Number.isFinite(t)||!Number.isFinite(e)||t===0&&e===0||this.mode==="near")return;this.cancelTweenIntoGoals();const n=2*this.distance*Math.tan(io*Math.PI/360)/this.viewportHeight,s=this.tmpRight.setFromMatrixColumn(this.camera.matrixWorld,0),r=this.tmpUp.setFromMatrixColumn(this.camera.matrixWorld,1);this.goalTarget.addScaledVector(s,-t*n),this.goalTarget.addScaledVector(r,e*n),this.clampTarget(),this.target.copy(this.goalTarget),this.applyPosition(!1)}zoomBy(t){if(!Number.isFinite(t)||t<=0)return;this.cancelTweenIntoGoals();const e=ht(t,.2,5);this.goalDistance=ht(this.goalDistance/e,this.minDistance,this.maxDistance)}focus(t,e){if(this.mode==="near"||!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.z))return;this.goalTarget.set(t.x,t.y,t.z),this.clampTarget();const n=Number.isFinite(e)?e:this.baseRadius*.4;this.goalDistance=ht(n,this.minDistance,this.maxDistance)}reset(){if(this.mode==="near"){this.exitNear();return}this.goalTarget.set(0,0,0),this.goalTheta=Mi,this.goalPhi=yi,this.goalDistance=ht(this.baseRadius*Si,this.minDistance,this.maxDistance)}setPreset(t){if(this.mode==="near"){this.mode="orbit",this.savedPose=null,this.nearRadius=0,this.applyZoomLimits(),this.startTween(this.presetPose(t),fs);return}const e=this.presetPose(t);this.goalTheta=e.theta,this.goalPhi=e.phi,this.goalTarget.set(e.tx,e.ty,e.tz),this.goalDistance=ht(e.distance,this.minDistance,this.maxDistance)}applyZoomLimits(){if(this.mode==="near"){const t=Math.max(1e-6,this.nearRadius);this.minDistance=Math.max(1e-5,t*ip),this.maxDistance=Math.max(this.minDistance*1.8,t*sp),this.goalDistance=ht(this.goalDistance,this.minDistance,this.maxDistance),this.distance=ht(this.distance,this.minDistance,this.maxDistance);return}this.minDistance=Math.max(.02,this.baseRadius*dp),this.maxDistance=Math.max(2,this.baseRadius*fp),this.goalDistance=ht(this.goalDistance,this.minDistance,this.maxDistance),this.distance=ht(this.distance,this.minDistance,this.maxDistance)}clampDuration(t){return Number.isFinite(t)?ht(t,.3,2):fs}currentPose(){return{theta:this.theta,phi:this.phi,distance:this.distance,tx:this.target.x,ty:this.target.y,tz:this.target.z}}defaultPose(){return{theta:Mi,phi:yi,distance:ht(this.baseRadius*Si,this.minDistance,this.maxDistance),tx:0,ty:0,tz:0}}presetPose(t){return t==="top"?{theta:0,phi:gp,distance:ht(this.baseRadius*2.15,this.minDistance,this.maxDistance),tx:0,ty:0,tz:0}:t==="side"?{theta:0,phi:Math.PI/2,distance:ht(this.baseRadius*2.3,this.minDistance,this.maxDistance),tx:0,ty:0,tz:0}:{theta:Mi,phi:yi,distance:ht(this.baseRadius*Si,this.minDistance,this.maxDistance),tx:0,ty:0,tz:0}}composeNearPose(t,e,n){const s=Number.isFinite(n?.theta)?n.theta:this.goalTheta,r=Number.isFinite(n?.phi)?n.phi:this.goalPhi,a=ht(r,.42,Math.PI-.42);return{theta:s,phi:a,distance:ht(e*np,this.minDistance,this.maxDistance),tx:t.x,ty:t.y,tz:t.z}}startTween(t,e){this.tween={from:this.currentPose(),to:t,progress:0,duration:Math.max(.05,e)},this.goalTheta=t.theta,this.goalPhi=t.phi,this.goalDistance=ht(t.distance,this.minDistance,this.maxDistance),this.goalTarget.set(t.tx,t.ty,t.tz),this.moving=!0}cancelTweenIntoGoals(){this.tween&&(this.tween=null,this.goalTheta=this.theta,this.goalPhi=this.phi)}clampTarget(){const t=Math.max(.001,this.baseRadius*_p),e=this.goalTarget.length();e>t&&this.goalTarget.multiplyScalar(t/e)}applyPosition(t){const e=Math.sin(this.phi),n=Math.cos(this.phi),s=Math.sin(this.theta),r=Math.cos(this.theta);this.camera.position.set(this.target.x+this.distance*e*s,this.target.y+this.distance*n,this.target.z+this.distance*e*r),this.camera.up.set(0,1,0),this.camera.lookAt(this.target);const a=this.mode==="near"?ht(this.distance*.02,4e-4,5):ht(this.distance*.0015,8e-4,5),o=this.mode==="near"?Math.max(120,this.distance*90):Math.max(200,this.distance*8+this.baseRadius*40);(t||Math.abs(a-this.lastNear)>Math.max(this.lastNear*.08,1e-6)||Math.abs(o-this.lastFar)>Math.max(this.lastFar*.08,1e-4))&&(this.camera.near=a,this.camera.far=o,this.lastNear=a,this.lastFar=o,this.camera.updateProjectionMatrix()),this.camera.updateMatrixWorld()}}const rl=12,so=rl*2;class Mp{group=new fe;positions=new Float32Array(so*3);colors=new Float32Array(so*3);positionAttr;colorAttr;lineGeometry=new he;lineSegments;lineMat=new cn({vertexColors:!0,transparent:!0,opacity:.42,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1});arrowPositions=new Float32Array(6);arrowPositionAttr;arrowGeometry=new he;arrowLine;arrowLineMat=new cn({color:new gt(Gt.selection),transparent:!0,opacity:.24,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1});coneGeometry=new Pr(.35,1,14);coneMaterial=new Be({color:new gt(Gt.selection),transparent:!0,opacity:.32,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1});arrowCone;tmpColor=new gt;tmpDir=new N;tmpForward=new N(0,1,0);lastSelectionKey="";constructor(){this.group.name="r3d-distance-lines",this.positionAttr=new ce(this.positions,3),this.positionAttr.setUsage(35048),this.colorAttr=new ce(this.colors,3),this.colorAttr.setUsage(35048),this.lineGeometry.setAttribute("position",this.positionAttr),this.lineGeometry.setAttribute("color",this.colorAttr),this.lineGeometry.setDrawRange(0,0),this.lineSegments=new _r(this.lineGeometry,this.lineMat),this.lineSegments.frustumCulled=!1,this.lineSegments.renderOrder=8,this.arrowPositionAttr=new ce(this.arrowPositions,3),this.arrowPositionAttr.setUsage(35048),this.arrowGeometry.setAttribute("position",this.arrowPositionAttr),this.arrowLine=new Ci(this.arrowGeometry,this.arrowLineMat),this.arrowLine.frustumCulled=!1,this.arrowLine.renderOrder=9,this.arrowCone=new le(this.coneGeometry,this.coneMaterial),this.arrowCone.frustumCulled=!1,this.arrowCone.renderOrder=9,this.group.add(this.lineSegments,this.arrowLine,this.arrowCone)}sync(t,e,n){const s=ht(t.count,0,rl),r=s>0&&n.settings.showLabels;if(this.lineSegments.visible=r,r){let p=0;for(let d=0;d<s;d++){const m=t.items[d];if(m){this.tmpColor.set(hn(m.color,Gt.distance));for(let _=0;_<2;_++){const g=_===0?m.from:m.to,f=p*3;this.positions[f]=g.x,this.positions[f+1]=g.y,this.positions[f+2]=g.z,this.colors[f]=this.tmpColor.r,this.colors[f+1]=this.tmpColor.g,this.colors[f+2]=this.tmpColor.b,p++}}}this.lineGeometry.setDrawRange(0,p),this.positionAttr.needsUpdate=!0,this.colorAttr.needsUpdate=!0}else this.lineGeometry.setDrawRange(0,0);const a=!!e&&n.settings.showLabels&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.z);if(this.arrowLine.visible=a,this.arrowCone.visible=a,!a||!e){this.lastSelectionKey="";return}const o=Ho(e);if(this.lastSelectionKey=o.toExponential(3),!(o>1e-6)){this.arrowLine.visible=!1,this.arrowCone.visible=!1;return}const l=ko(e);this.tmpDir.set(l.x,l.y,l.z);const h=ht(o*.16,n.viewRadius*.008,Math.max(n.viewRadius*.008,n.viewRadius*.05)),u=Math.max(0,o-h*1.05);this.arrowPositions[0]=0,this.arrowPositions[1]=0,this.arrowPositions[2]=0,this.arrowPositions[3]=l.x*u,this.arrowPositions[4]=l.y*u,this.arrowPositions[5]=l.z*u,this.arrowPositionAttr.needsUpdate=!0,this.arrowLine.visible=u>1e-6,this.arrowCone.position.set(e.x-l.x*h*.5,e.y-l.y*h*.5,e.z-l.z*h*.5),this.arrowCone.quaternion.setFromUnitVectors(this.tmpForward,this.tmpDir),this.arrowCone.scale.set(h,h,h)}dispose(){this.lineGeometry.dispose(),this.lineMat.dispose(),this.arrowGeometry.dispose(),this.arrowLineMat.dispose(),this.coneGeometry.dispose(),this.coneMaterial.dispose(),this.group.clear(),this.lastSelectionKey=""}}const yp={top:"俯视",side:"侧视",free:"自由"};function zt(i,t,e,n=""){const s=i.createElement(t);return e&&(s.className=e),n&&(s.textContent=n),s}function Sp(i,t={}){if(typeof document>"u"||!i||typeof i.appendChild!="function")return null;let e;try{e=document.createElement("div")}catch{return null}e.className="r3d-hud";try{i.appendChild(e)}catch{return null}const n=e.ownerDocument??document,s=zt(n,"div","r3d-card r3d-status"),r=zt(n,"div","r3d-kicker","OBSERVATION SPACE · 3D"),a=zt(n,"div","r3d-title","观测中"),o=zt(n,"div","r3d-meta",""),l=zt(n,"div","r3d-line","未选中天体 · 点击天体进入近景"),h=zt(n,"div","r3d-note","高度数据未解锁 · 仅显示二维等价信息");h.style.display="none",s.append(r,a,o,l,h);const u=zt(n,"div","r3d-card r3d-view"),p=zt(n,"div","r3d-kicker","VIEW / 视角"),d=zt(n,"div","r3d-view-row"),m=zt(n,"div","r3d-view-preset","自由"),_=zt(n,"div","r3d-tag","硬件加速");d.append(m,_);const g=zt(n,"div","r3d-hint","拖拽旋转 · 滚轮缩放 · 右键平移 · 点击天体进入近景"),f=zt(n,"div","r3d-scale-row"),c=zt(n,"span","r3d-scale-label",""),b=zt(n,"span","r3d-scale-bar"),E=zt(n,"i","r3d-scale-tick is-start"),M=zt(n,"i","r3d-scale-tick is-mid"),C=zt(n,"i","r3d-scale-tick is-end");b.append(E,M,C),f.append(b,c);const A=zt(n,"div","r3d-perf","渲染 — fps · 贴图 0/6");u.append(p,d,g,f,A);const R=zt(n,"div","r3d-card r3d-near"),P=zt(n,"div","r3d-near-head"),S=zt(n,"div","r3d-near-headtext"),x=zt(n,"div","r3d-kicker","NEAR OBSERVATION · 近景观测"),w=zt(n,"div","r3d-near-title","—");S.append(x,w);const I=zt(n,"button","r3d-icon-btn","×");I.type="button",I.title="返回全景（Esc）",I.setAttribute("aria-label","返回全景"),P.append(S,I);const B=zt(n,"div","r3d-near-accent"),O=zt(n,"div","r3d-near-sub",""),G=zt(n,"div","r3d-near-warning","");G.style.display="none";const W=zt(n,"div","r3d-near-grid"),Z=10,k=[];for(let Mt=0;Mt<Z;Mt+=1){const ct=zt(n,"div","r3d-near-row"),Wt=zt(n,"div","r3d-near-label",""),ut=zt(n,"div","r3d-near-value","");ct.append(Wt,ut),ct.style.display="none",W.appendChild(ct),k.push({row:ct,label:Wt,value:ut})}const tt=zt(n,"div","r3d-near-targets"),lt=new Map;for(const Mt of hp){const ct=zt(n,"button","r3d-target-btn",Mt.label);ct.type="button",ct.dataset.body=Mt.id,ct.title="切换近景目标："+Mt.label,tt.appendChild(ct),lt.set(Mt.id,ct)}const vt=zt(n,"div","r3d-near-footer"),Lt=zt(n,"div","r3d-near-note","仅显示观测数据 · 不含模拟真值"),Xt=zt(n,"div","r3d-near-zoom","拖拽旋转 · 滚轮缩放"),q=zt(n,"button","r3d-return-btn","返回全景 · ESC");q.type="button",vt.append(Lt,Xt,q),R.append(P,B,O,G,W,tt,vt),R.style.display="none",e.append(s,u,R),I.addEventListener("click",()=>t.onExitNear?.()),q.addEventListener("click",()=>t.onExitNear?.()),tt.addEventListener("click",Mt=>{const ut=Mt.target?.closest?.(".r3d-target-btn")?.dataset?.body;(ut==="A"||ut==="B"||ut==="C"||ut==="planet")&&t.onSelectBody?.(ut)});let Q="",xt="",it="",Tt=null,Ct="",Bt="",te=-1,Vt="",re="",U=!1,Se=null;function Ht(Mt,ct){for(let Wt=0;Wt<Mt.stars.length;Wt++){const ut=Mt.stars[Wt];if(ut.id===ct)return{name:ut.name||ct,posY:Number.isFinite(ut.pos?.y)?ut.pos.y:0,sigmaAU:ut.sigmaAU}}return null}return{root:e,sync(Mt,ct,Wt,ut,T){const v=ut!==null;if(v!==U&&(U=v,R.style.display=v?"":"none",s.style.display=v?"none":"",u.style.display=v?"none":""),!v){const at=Mt.statusLabel&&Mt.statusLabel.length>0?Mt.statusLabel:"观测中";at!==Q&&(Q=at,a.textContent=at);const nt=[];nt.push(String(Math.round(Mt.calendarYear))+" 年"),nt.push("观测等级 "+String(Number.isFinite(Mt.observatoryLevel)?Mt.observatoryLevel:0)),Mt.hasColony&&nt.push("殖民地在线"),Mt.paused&&nt.push("暂停");const st=nt.join(" · ");st!==xt&&(xt=st,o.textContent=st);let At="未选中天体 · 点击天体进入近景";if(Mt.selection==="planet"&&Mt.planet)At="选中 · 母星 · 点击再次进入近景",ct.heightDataAvailable&&(At+=" · "+ri(Mt.planet.pos.y));else if(Mt.selection){const X=Ht(Mt,Mt.selection);X&&(At="选中 · "+X.name+" · 点击再次进入近景",ct.heightDataAvailable&&(At+=" · "+ri(X.posY)),Number.isFinite(X.sigmaAU)&&X.sigmaAU>0&&(At+=" · "+Ii(X.sigmaAU)))}At!==it&&(it=At,l.textContent=At);const J=!ct.heightDataAvailable;J!==Tt&&(Tt=J,h.style.display=J?"block":"none");const _t=yp[Wt]??"自由";_t!==Ct&&(Ct=_t,m.textContent=_t);const wt=ct.camera.fov*Math.PI/180,Rt=Math.max(2,ct.height),mt=2*Math.max(1e-6,ct.cameraDistance)*Math.tan(wt*.5)/Rt,kt=ht(ct.width*.07,56,110);let Dt=80,Yt=0;Number.isFinite(mt)&&mt>0&&(Yt=Mr(mt*kt),Dt=ht(Yt/mt,24,180));const D=Number.isFinite(Yt)&&Yt>0?je(Yt):"";D!==Bt&&(Bt=D,c.textContent=D);const rt=Math.round(Dt);rt!==te&&(te=rt,b.style.width=rt+"px")}const z=T.fps>0?Math.round(T.fps)+" fps":"统计中",K=T.quality==="low"?"软件渲染 · 降级分段":"硬件加速",$="贴图 "+T.textures.loaded+"/"+T.textures.total,Y=v?"近景渲染 · "+z+" · "+K+" · "+$:"渲染 "+z+" · "+K+" · "+$;if(Y!==Vt&&(Vt=Y,A.textContent=Y,_&&(_.textContent=T.quality==="low"?"软件渲染":"硬件加速"),Xt.textContent=v?"缩放限位 "+je(ut.zoom.min)+" – "+je(ut.zoom.max)+" · "+z:""),v){const at=ut.info,nt=at.id+"|"+at.title+"|"+at.rows.map(st=>st.label+"="+st.value).join(";")+"|"+(at.warning??"");if(nt!==re){re=nt,w.textContent=at.title,O.textContent=at.subtitle,B.style.background=at.accent,B.dataset.kind=at.kind,at.warning?(G.style.display="block",G.textContent=at.warning):(G.style.display="none",G.textContent="");for(let st=0;st<k.length;st+=1){const At=k[st],J=at.rows[st];if(!J){At.row.style.display="none";continue}At.row.style.display="",At.label.textContent=J.label,At.value.textContent=J.value,At.value.dataset.tone=J.tone??"ink"}}Se!==at.id&&(Se=at.id,lt.forEach((st,At)=>{st.classList.toggle("is-active",At===at.id)}))}},dispose(){try{e.remove()}catch{try{i.removeChild(e)}catch{}}}}}const Ep=96,bp=5,ps=10,al="650 10.5px "+Cs.ui,Ai="9px "+Cs.mono,Fn="8.5px "+Cs.mono,ro="600 9px "+Cs.mono,Tp=12,Ap=7,ol="#3a3a3a",Pi="#6b6b6b",yr="#2b2b2b",ll="#7a5200";function wp(i,t){const e=/(\d+(?:\.\d+)?)px/.exec(t),n=e?Number(e[1]):10;let s=0;for(let r=0;r<i.length;r++)s+=i.charCodeAt(r)>11903?n*1.22:n*.64;return s}function Rp(i){let t=Ap;for(const e of i){const n=/(\d+(?:\.\d+)?)px/.exec(e.font);t+=(n?Number(n[1]):10)*1.34}return t}function Cp(i,t,e=5){return i.x-e<t.x+t.w&&i.x+i.w+e>t.x&&i.y-e<t.y+t.h&&i.y+i.h+e>t.y}function ao(i,t,e,n=null){const s=hn(i.color,Gt.accent),r=[{text:i.name||"未知恒星",color:i.known?on(s,.45):Ne(s,.7),font:al}],a=Math.hypot(Number.isFinite(i.pos?.x)?i.pos.x:0,Number.isFinite(i.pos?.z)?i.pos.z:0);if(r.push({text:(i.known?"R "+je(a):"位置未定")+" · "+$o(i.confidence),color:i.known?ol:ll,font:Ai}),e.heightDataAvailable&&r.push({text:ri(i.pos.y),color:yr,font:Ai}),t){e.heightDataAvailable&&n!==null&&Number.isFinite(n)&&r.push({text:"轨道倾角 "+n.toFixed(1)+"°",color:yr,font:Fn}),Number.isFinite(i.sigmaAU)&&i.sigmaAU>0&&r.push({text:Ii(i.sigmaAU),color:Pi,font:Fn});const o=[];i.mass!==null&&Number.isFinite(i.mass)&&o.push(Zo(i.mass)),i.tempK!==null&&Number.isFinite(i.tempK)&&o.push(Ko(i.tempK)),o.length>0&&r.push({text:o.join(" · "),color:Pi,font:Fn})}return r}function oo(i,t,e){const n=[{text:"母星",color:"#eaf7ff",font:al}],s=[];return i.tempC!==null&&Number.isFinite(i.tempC)&&s.push(Yo(i.tempC)),i.habitability!==null&&Number.isFinite(i.habitability)&&s.push(jo(i.habitability)),s.length>0?n.push({text:s.join(" · "),color:ol,font:Ai}):n.push({text:"环境数据待观测",color:ll,font:Ai}),e.heightDataAvailable&&n.push({text:ri(i.pos.y),color:yr,font:Ai}),t&&(Number.isFinite(i.sigmaAU)&&i.sigmaAU>0&&n.push({text:Ii(i.sigmaAU),color:Pi,font:Fn}),Number.isFinite(i.radiusKm)&&i.radiusKm>0&&n.push({text:"半径 "+Ur(i.radiusKm),color:Pi,font:Fn})),n}function Pp(i){if(typeof document>"u"||!i||typeof i.appendChild!="function")return null;let t;try{t=document.createElement("div")}catch{return null}t.style.cssText="position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;z-index:3;contain:layout style;";try{i.appendChild(t)}catch{return null}const e=t.ownerDocument??document,n=new Map,s=new Set,r=[],a={x:0,y:0,depth:0,visible:!1};let o=!0;function l(f){const c=e.createElement("div");c.className="r3d-label",c.style.cssText="position:absolute;left:0;top:0;display:none;white-space:nowrap;text-align:center;pointer-events:none;will-change:transform;";const b=[];for(let M=0;M<bp;M++){const C=e.createElement("div");C.className="r3d-label-line",c.appendChild(C),b.push(C)}t.appendChild(c);const E={key:f,el:c,lines:b,texts:[],colors:[],fonts:[],visible:!1,lastTransform:""};return n.set(f,E),E}function h(f){return n.get(f)??l(f)}function u(f){f.visible&&(f.visible=!1,f.el.style.display="none")}function p(f,c,b){for(let E=0;E<f.lines.length;E++){const M=c[E],C=f.lines[E];if(!M){f.texts[E]!==""&&(f.texts[E]="",C.textContent="",C.style.display="none");continue}f.texts[E]!==M.text&&(f.texts[E]=M.text,C.textContent=M.text),f.colors[E]!==M.color&&(f.colors[E]=M.color,C.style.color=M.color),f.fonts[E]!==M.font&&(f.fonts[E]=M.font,C.style.font=M.font),C.style.display!=="block"&&(C.style.display="block")}f.lastTransform!==b&&(f.lastTransform=b,f.el.style.transform=b),f.visible=!0,f.el.style.display!=="block"&&(f.el.style.display="block")}function d(f,c,b,E,M,C){const A=[];return C&&A.push({pointX:f,pointY:c,translate:"translate(-50%,-50%)",boxX:f-E/2,boxY:c-M/2}),A.push({pointX:f,pointY:c-b,translate:"translate(-50%,-100%)",boxX:f-E/2,boxY:c-b-M}),A.push({pointX:f+b,pointY:c,translate:"translate(0,-50%)",boxX:f+b,boxY:c-M/2}),A.push({pointX:f-b,pointY:c,translate:"translate(-100%,-50%)",boxX:f-b-E,boxY:c-M/2}),A.push({pointX:f,pointY:c+b,translate:"translate(-50%,0)",boxX:f-E/2,boxY:c+b}),A.push({pointX:f+b*.72,pointY:c-b*.72,translate:"translate(0,-100%)",boxX:f+b*.72,boxY:c-b*.72-M}),A.push({pointX:f-b*.72,pointY:c-b*.72,translate:"translate(-100%,-100%)",boxX:f-b*.72-E,boxY:c-b*.72-M}),A}function m(f,c,b,E,M,C,A){if(!E||E.length===0)return;let R=0;for(const O of E)R=Math.max(R,wp(O.text,O.font));R=Math.max(30,R+Tp);const P=Rp(E),S=ht(M+8,10,140),x=d(c,b,S,R,P,!!A?.center),w=[];for(let O=1;O<=3;O++){const G=O*18;w.push({pointX:c,pointY:b-S+G,translate:"translate(-50%,-100%)",boxX:c-R/2,boxY:b-S+G-P}),w.push({pointX:c,pointY:b+S+G,translate:"translate(-50%,0)",boxX:c-R/2,boxY:b+S+G}),w.push({pointX:c+S,pointY:b+G,translate:"translate(0,-50%)",boxX:c+S,boxY:b+G-P/2})}const I=h(f),B=x.concat(w);for(let O=0;O<B.length;O++){const G=B[O];if(G.boxX<ps||G.boxY<ps||G.boxX+R>C.width-ps||G.boxY+P>C.height-ps)continue;const W={x:G.boxX,y:G.boxY,w:R,h:P};let Z=!1;for(let tt=0;tt<r.length;tt++)if(Cp(W,r[tt])){Z=!0;break}if(Z)continue;r.push(W),s.add(f);const k="translate3d("+G.pointX.toFixed(1)+"px,"+G.pointY.toFixed(1)+"px,0) "+G.translate;p(I,E,k);return}u(I)}function _(f,c){if(ei(c.camera,f.pos,c.width,c.height,a),!a.visible)return null;const b=ht(f.worldRadius*qo(c.camera,f.pos,c.height),1.5,220);return{x:a.x,y:a.y,radiusPx:b}}function g(f){return Ne(f==="X"?Gt.axisX:f==="Y"?Gt.axisY:Gt.axisZ,.8)}return{root:t,sync(f,c,b,E,M,C){if(s.clear(),r.length=0,c.nearBody){o&&(o=!1,t.style.display="none"),n.forEach(x=>u(x));return}if(!c.settings.showLabels){o&&(o=!1,t.style.display="none"),n.forEach(x=>u(x));return}if(o||(o=!0,t.style.display="block"),c.width<60||c.height<60){n.forEach(x=>u(x));return}const A=c.selection;let R=null;if(A){for(let x=0;x<b.length;x++)if(b[x].id===A){R=b[x];break}}if(R){const x=_(R,c);if(x){const w=A!=="planet"&&C?C(String(A)):null,I=A==="planet"&&f.planet?oo(f.planet,!0,c):(()=>{for(let B=0;B<f.stars.length;B++)if(f.stars[B].id===A)return ao(f.stars[B],!0,c,w);return[]})();I.length>0&&m("sel:"+String(A),x.x,x.y,I,x.radiusPx,c)}}const P=[];for(let x=0;x<b.length;x++){const w=b[x];if(R&&w.id===R.id)continue;const I=_(w,c);if(!I)continue;if(w.id==="planet"){if(!f.planet)continue;P.push({key:"body:planet",x:I.x,y:I.y,radiusPx:I.radiusPx,lines:oo(f.planet,!1,c)});continue}let B=null;for(let O=0;O<f.stars.length;O++)if(f.stars[O].id===w.id){B=f.stars[O];break}B&&P.push({key:"body:"+B.id,x:I.x,y:I.y,radiusPx:I.radiusPx,lines:ao(B,!1,c)})}P.sort((x,w)=>Math.abs(x.y-w.y)>1?x.y-w.y:x.x-w.x);for(let x=0;x<P.length;x++){const w=P[x];m(w.key,w.x,w.y,w.lines,w.radiusPx,c)}if(E.count>0&&A)for(let x=0;x<E.count;x++){const w=E.items[x];if(!w||(ei(c.camera,w.mid,c.width,c.height,a),!a.visible))continue;const I=[{text:je(w.distanceAU),color:Ne(w.color,.92),font:ro}];c.heightDataAvailable&&w.deltaHeightAU!==null&&I.push({text:Kf(w.deltaHeightAU),color:Pi,font:Fn}),m("dist:"+x,a.x,a.y,I,4,c)}if(c.settings.showGrid&&M)for(let x=0;x<M.length;x++){const w=M[x];if(ei(c.camera,w.pos,c.width,c.height,a),!a.visible)continue;const I=[{text:w.label+" · AU",color:g(w.label),font:Fn}];m("axis:"+w.label,a.x,a.y,I,2,c,{center:!0})}const S=f.pulses??[];for(let x=0;x<S.length;x++){const w=S[x];if(!w||typeof w.label!="string"||w.label.length===0||(ei(c.camera,w.pos,c.width,c.height,a),!a.visible))continue;const I=ht(Number.isFinite(w.severity)?w.severity:.5,0,1),B=[{text:w.label,color:Ne(Zf(I),.95),font:ro}];m("pulse:"+w.id,a.x,a.y,B,10+I*14,c)}if(n.forEach((x,w)=>{s.has(w)||u(x)}),n.size>Ep){const x=[];n.forEach((w,I)=>{s.has(I)||x.push(I)});for(const w of x){const I=n.get(w);if(I){n.delete(w);try{t.removeChild(I.el)}catch{}}}}},dispose(){n.clear(),r.length=0,s.clear();try{t.remove()}catch{try{i.removeChild(t)}catch{}}}}}const Dp=6,Lp=72;function Up(i){const t=new Float32Array((i+1)*3);for(let n=0;n<=i;n++){const s=n/i*Math.PI*2;t[n*3]=Math.cos(s),t[n*3+1]=Math.sin(s),t[n*3+2]=0}const e=new he;return e.setAttribute("position",new ce(t,3)),e}function Fp(i){const t=i.points,e=t?t.length:0;if(e===0)return"empty";const n=t[0],s=t[e-1];return i.id+"|"+e+"|"+(n.x.toFixed(3)+","+n.y.toFixed(3)+","+n.z.toFixed(3))+"|"+(s.x.toFixed(3)+","+s.y.toFixed(3)+","+s.z.toFixed(3))}class Np{group=new fe;visuals=new Map;usedKeys=new Set;discGeometry=new Rr(1,96);ringGeometry=Up(Lp);forward=new N(0,0,1);normal=new N(0,1,0);constructor(){this.group.name="r3d-orbit-planes"}sync(t,e){this.usedKeys.clear();const n=[],s=t.observedTrails??[];let r=!1;for(let a=0;a<s.length;a++)if((s[a]?.points?.length??0)>=3){r=!0;break}if(r)for(let a=0;a<s.length;a++)s[a]&&n.push(s[a]);else{const a=t.predictedTrails??[];for(let o=0;o<a.length;o++)a[o]&&n.push(a[o])}for(let a=0;a<n.length&&a<Dp;a++){const o=n[a],l="plane:"+o.id,h=Fp(o),u=this.ensure(l);if(this.usedKeys.add(l),u.signature!==h){u.signature=h;const g=Xf(o.points??[]);u.fit=g,g.valid&&(u.group.position.set(g.center.x,g.center.y,g.center.z),this.normal.set(g.normal.x,g.normal.y,g.normal.z),u.group.quaternion.setFromUnitVectors(this.forward,this.normal),u.group.scale.setScalar(Math.max(1e-6,g.radiusAU*1.04)))}if(!u.fit.valid){u.group.visible=!1;continue}u.group.visible=!0;const d=tl(o.id,o.color);u.colorHex!==d&&(u.colorHex=d,u.discMat.color.set(d),u.ringMat.color.set(on(d,.25)));const m=!!e.selection&&bs(o.id)===e.selection,_=ht(.04+(o.alpha??.8)*.05,.035,.11);u.discMat.opacity=m?_*2.8:_,u.ringMat.opacity=m?.42:.16}this.visuals.forEach((a,o)=>{this.usedKeys.has(o)||(a.group.visible=!1)})}inclinationDeg(t){if(!t)return null;let e=null;return this.visuals.forEach((n,s)=>{if(!n.fit.valid||bs(s.replace("plane:",""))!==t)return;const r=ht(Math.abs(n.fit.normal.y),0,1),a=Math.acos(r)*180/Math.PI;(e===null||a>e)&&(e=a)}),e}ensure(t){const e=this.visuals.get(t);if(e)return e;const n=new Be({color:new gt(Gt.orbitPlane),transparent:!0,opacity:.06,depthWrite:!1,depthTest:!0,side:2,toneMapped:!1}),s=new le(this.discGeometry,n);s.frustumCulled=!1,s.renderOrder=2;const r=new cn({color:new gt(on(Gt.orbitPlane,.25)),transparent:!0,opacity:.16,depthWrite:!1,depthTest:!0,toneMapped:!1}),a=new Pf(this.ringGeometry,r);a.frustumCulled=!1,a.renderOrder=3;const o=new fe;o.name="r3d-orbit-plane-"+t,o.add(s,a),this.group.add(o);const l={key:t,group:o,disc:s,ring:a,discMat:n,ringMat:r,fit:Xo(),signature:"",colorHex:""};return this.visuals.set(t,l),l}dispose(){this.visuals.forEach(t=>{try{this.group.remove(t.group),t.discMat.dispose(),t.ringMat.dispose()}catch{}}),this.visuals.clear(),this.usedKeys.clear(),this.discGeometry.dispose(),this.ringGeometry.dispose(),this.group.clear()}}const lo={showTrails:!0,showPrediction:!0,showGrid:!0,showLabels:!0,showUncertainty:!0};function Ip(i){return i==="A"||i==="B"||i==="C"||i==="planet"}class Bp{raycaster=new zf;ndc=new It;pick(t,e,n,s,r){if(!r||r.length===0)return null;const a=n.width>1?n.width:1,o=n.height>1?n.height:1,l=(t-n.left)/a*2-1,h=-((e-n.top)/o)*2+1;if(!Number.isFinite(l)||!Number.isFinite(h))return null;this.ndc.set(l,h),this.raycaster.setFromCamera(this.ndc,s);let u=[];try{u=this.raycaster.intersectObjects(r,!1)}catch{return null}for(let p=0;p<u.length;p++){const m=u[p].object?.userData?.id;if(Ip(m))return m}return null}dispose(){this.ndc.set(0,0)}}const ur=["star-a","star-b","star-c","planet-day","planet-clouds","planet-night"];function cl(i){return i==="A"?"star-a":i==="B"?"star-b":i==="C"?"star-c":null}const Br="/textures/",Op=Br+"manifest.json",zp={"star-a":["jpg","png"],"star-b":["jpg","png"],"star-c":["jpg","png"],"planet-day":["jpg","png"],"planet-clouds":["png","jpg"],"planet-night":["jpg","png"],"planet-water-mask":["jpg","png"],"planet-normal":["jpg","png"]};let Sr=4;function Er(i,t,e=0){if(!(e>8||i===null||i===void 0)){if(typeof i=="string"){const n=/([a-z0-9-]+)\.(jpe?g|png)$/i.exec(i.trim());if(!n)return;const s=n[1].toLowerCase();t[s]||(t[s]=Gp(i));return}if(Array.isArray(i)){for(let n=0;n<i.length;n++)Er(i[n],t,e+1);return}if(typeof i=="object")for(const n of Object.keys(i))Er(i[n],t,e+1)}}function Gp(i){let t=i.trim().replace(/\\/g,"/");if(/^https?:\/\//i.test(t))return t;const e=t.toLowerCase().lastIndexOf("textures/");return e>=0?t=t.slice(e):t=t.replace(/^\.?\//,""),t.startsWith("textures/")?t="/"+t:t=Br+t,t}function Or(){return typeof document<"u"&&typeof document.createElement=="function"}class Vp{entries=new Map;listeners=new Set;manifest={value:{},done:!1,promise:null};setMaxAnisotropy(t){Number.isFinite(t)&&t>=1&&(Sr=Math.min(16,Math.max(1,Math.round(t))))}get(t){return this.entries.get(t)?.texture??null}status(t){return this.entries.get(t)?.state??"idle"}snapshot(){const t={};for(const e of ur)t[e]=this.status(e);return t}loadedCount(){let t=0,e=0;for(const n of ur){const s=this.status(n);s==="loaded"?t+=1:s==="loading"&&(e+=1)}return{loaded:t,pending:e,total:ur.length}}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}request(t){const e=this.ensureEntry(t);if(e.state==="idle"){if(!Or()){e.state="unsupported";return}e.state="loading",this.loadManifest().then(()=>this.loadNext(e,0))}}requestForBody(t){if(t==="planet"){this.request("planet-day"),this.request("planet-clouds"),this.request("planet-night"),this.request("planet-water-mask"),this.request("planet-normal");return}const e=cl(t);e&&this.request(e)}ensureEntry(t){const e=this.entries.get(t);if(e)return e;const n={id:t,state:"idle",texture:null,resolvedUrl:null,urls:[],error:null};return this.entries.set(t,n),n}loadManifest(){return this.manifest.done?Promise.resolve():this.manifest.promise?this.manifest.promise:(this.manifest.promise=(async()=>{try{const t=await fetch(Op,{cache:"no-cache"});if(t.ok){const e=await t.json();Er(e,this.manifest.value)}}catch{}this.manifest.done=!0,this.manifest.promise=null})(),this.manifest.promise)}loadNext(t,e){if(t.state!=="loading")return;if(e===0&&(t.urls=this.urlCandidates(t.id)),e>=t.urls.length){t.state="error",t.error="贴图不可用（manifest 与 /textures/<stem>.jpg|.png 均未命中）",this.emitChange();return}const n=t.urls[e];let s;try{s=new Ff}catch{t.state="unsupported",this.emitChange();return}try{s.load(n,r=>{if(t.state!=="loading"){try{r.dispose()}catch{}return}t.resolvedUrl=n,t.texture=this.configureTexture(r),t.state="loaded",this.emitChange()},void 0,()=>{this.loadNext(t,e+1)})}catch{this.loadNext(t,e+1)}}urlCandidates(t){const e=[],n=a=>{a&&e.indexOf(a)<0&&e.push(a)},s=this.manifest.value[t];s&&n(s);const r=zp[t]??["jpg","png"];for(const a of r)n(Br+t+"."+a);return e}configureTexture(t){try{t.colorSpace=Te,t.wrapS=1e3,t.wrapT=1001,t.minFilter=1008,t.magFilter=1006,t.anisotropy=Sr,t.needsUpdate=!0}catch{}return t}emitChange(){this.listeners.forEach(t=>{try{t()}catch{}})}dispose(){this.entries.forEach(t=>{try{t.texture?.dispose()}catch{}}),this.entries.clear(),this.listeners.clear(),this.manifest.value={},this.manifest.done=!1,this.manifest.promise=null}}const De=new Vp;function Hp(i,t=512){if(!i||!Or())return null;try{const e=document.createElement("canvas");let n=1,s=1;const r=i;n=Math.max(1,Math.floor(Number(r.width??r.videoWidth)||1)),s=Math.max(1,Math.floor(Number(r.height??r.videoHeight)||1));const a=Math.min(1,t/n);e.width=Math.max(2,Math.round(n*a)),e.height=Math.max(2,Math.round(s*a));const o=e.getContext("2d",{willReadFrequently:!0});if(!o)return null;o.drawImage(i,0,0,e.width,e.height);const l=o.getImageData(0,0,e.width,e.height),h=l.data,u=e.width,p=e.height,d=new Float32Array(u*p);for(let g=0,f=0;g<h.length;g+=4,f+=1){const c=h[g],b=h[g+1],E=h[g+2],M=E-Math.max(c,b),C=(c+b+E)/3;let A=0;M>4&&C<215&&E>45&&(A=Math.min(1,(M-4)/26+(C<150?.42:.12))),d[f]=A}const m=new Uint8ClampedArray(u*p);for(let g=0;g<p;g+=1)for(let f=0;f<u;f+=1){let c=0,b=0;for(let E=-1;E<=1;E+=1){const M=g+E;if(!(M<0||M>=p))for(let C=-1;C<=1;C+=1){const A=f+C;A<0||A>=u||(c+=d[M*u+A],b+=1)}}m[g*u+f]=Math.round((b>0?c/b:0)*255)}for(let g=0,f=0;g<m.length;g+=1,f+=4){const c=m[g];h[f]=c,h[f+1]=c,h[f+2]=c,h[f+3]=255}o.putImageData(l,0,0);const _=new Go(e);return _.wrapS=1e3,_.wrapT=1001,_.anisotropy=Sr,_.needsUpdate=!0,_}catch{return null}}function kp(i){const t=i?.image;if(!t||!Or())return!1;try{const e=document.createElement("canvas");e.width=64,e.height=32;const n=e.getContext("2d",{willReadFrequently:!0});if(!n)return!1;n.drawImage(t,0,0,64,32);const s=n.getImageData(0,0,64,32).data;let r=0;for(let a=3;a<s.length;a+=4)s[a]<250&&(r+=1);return r>16}catch{return!1}}function Wp(){De.dispose()}function Xp(i,t){const e=Math.max(.001,Number.isFinite(t)?t:1),n=Number.isFinite(i.radiusKm)&&i.radiusKm>1?i.radiusKm/Lr:426e-7,s=e*.0052,r=n*16;return ht(Math.max(s,r),e*.0018,e*.06)}function co(i,t){let e="#93aebf";if(i!==null&&Number.isFinite(i)&&(i<=-80?e="#8fb9d8":i<=-25?e="#a8cbe2":i>=150?e="#d9885f":i>=70?e="#c9a575":e="#9fb9c6"),t!==null&&Number.isFinite(t)){const n=ht(t,0,1);e=yn(e,n>=.5?"#6fe0b0":"#b5a98c",.18+n*.5)}return e}const ho=[32,24],uo=[96,64],fo=[56,36],qp=`
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vec4 viewPosition = viewMatrix * worldPosition;
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize( mat3( modelMatrix ) * normal );
  gl_Position = projectionMatrix * viewPosition;
}
`,Yp=`
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 viewDir = normalize( cameraPosition - vWorldPosition );
  float rim = 1.0 - clamp( dot( normalize( vWorldNormal ), viewDir ), 0.0, 1.0 );
  float glow = pow( rim, 3.1 ) * uIntensity;
  gl_FragColor = vec4( uColor * glow, glow );
}
`;class Kp{group=new fe;pickables=[];farGeometry=null;nearGeometryHigh=null;nearGeometryLow=null;geometryKind=null;ringGeometry=new Ni(.9,1,56);pickGeometry=new ke(1,8,6);pickMaterial=new Be({visible:!1});surfaceMat;surface;cloudsMat;clouds;atmosphereMat;atmosphere;glowMat;glow;ringMat;ring;pick;light;ambient;anchor={id:"planet",pos:{x:0,y:0,z:0},worldRadius:0,color:Gt.planet};lastTone="";visible=!1;nearMode=!1;textured=!1;cloudsTextured=!1;oceanSpecular=null;oceanSpecularOwned=!1;dayTexture=null;nightTexture=null;cloudsTexture=null;shaderRef=null;nightDirView=new N;tmpVec=new N;constructor(){this.group.name="r3d-planet",this.surfaceMat=new Ka({color:new gt("#93aebf"),specular:new gt("#b9d6e8"),shininess:46,emissive:new gt("#0c2028"),emissiveIntensity:.16,toneMapped:!1}),this.surfaceMat.customProgramCacheKey=()=>"r3d-planet-night-mask-v1",this.surfaceMat.onBeforeCompile=t=>{try{t.uniforms.uNightDirView={value:this.nightDirView},t.fragmentShader=`uniform vec3 uNightDirView;
`+t.fragmentShader,t.fragmentShader=t.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
	float r3dNightMask = 1.0 - smoothstep( -0.28, 0.12, dot( nonPerturbedNormal, uNightDirView ) );`),t.fragmentShader=t.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
	totalEmissiveRadiance *= r3dNightMask;`),this.shaderRef=t}catch{this.shaderRef=null}},this.surface=new le(this.geometryFor("far"),this.surfaceMat),this.surface.frustumCulled=!1,this.surface.renderOrder=0,this.cloudsMat=new Ka({color:new gt("#ffffff"),transparent:!0,opacity:.62,depthWrite:!1,side:2,toneMapped:!1}),this.clouds=new le(this.surface.geometry,this.cloudsMat),this.clouds.frustumCulled=!1,this.clouds.visible=!1,this.clouds.renderOrder=4,this.atmosphereMat=new ln({uniforms:{uColor:{value:new gt(Gt.planet)},uIntensity:{value:.9}},vertexShader:qp,fragmentShader:Yp,transparent:!0,depthWrite:!1,blending:2,side:1}),this.atmosphere=new le(this.surface.geometry,this.atmosphereMat),this.atmosphere.frustumCulled=!1,this.atmosphere.visible=!1,this.atmosphere.renderOrder=6,this.glowMat=new Ri({map:ii(Gt.planet)??null,color:new gt(16777215),transparent:!0,opacity:.3,depthWrite:!1,blending:2,toneMapped:!1}),this.glow=new Ms(this.glowMat),this.glow.frustumCulled=!1,this.glow.renderOrder=8,this.ringMat=new Be({color:new gt(Gt.selection),transparent:!0,opacity:.5,depthWrite:!1,side:2,blending:2,toneMapped:!1}),this.ring=new le(this.ringGeometry,this.ringMat),this.ring.frustumCulled=!1,this.ring.visible=!1,this.ring.renderOrder=12,this.light=new Bf(new gt(16777215),2.4),this.light.position.set(0,0,6),this.light.target.position.set(0,0,0),this.ambient=new Of(new gt(2768727),.75),this.pick=new le(this.pickGeometry,this.pickMaterial),this.pick.userData.id="planet",this.pick.frustumCulled=!1,this.group.add(this.surface,this.clouds,this.atmosphere,this.glow,this.ring,this.pick,this.light,this.light.target,this.ambient),this.group.visible=!1}anchorOrNull(){return this.visible?this.anchor:null}get textureReady(){return this.textured}sync(t,e){const n=t.planet;if(this.pickables.length=0,!n||!Number.isFinite(n.pos?.x)||!Number.isFinite(n.pos?.y)||!Number.isFinite(n.pos?.z)){this.visible=!1,this.group.visible=!1;return}const s=e.nearBody==="planet";this.nearMode=s,this.visible=!0,this.group.visible=!0;const r=s&&e.nearRadius>0?e.nearRadius:Xp(n,e.cameraDistance);this.group.position.set(n.pos.x,n.pos.y,n.pos.z),this.surface.scale.setScalar(r),this.setGeometryKind(s?e.quality==="low"?"near-low":"near-high":"far");const a=s?.1:.12;this.surface.rotation.y=e.time*a%(Math.PI*2);const o=this.nearestStar(n.pos,t.stars??[]);let l={x:0,y:0,z:1};if(o){const d=ko(Gf(o.pos,n.pos));(d.x!==0||d.y!==0||d.z!==0)&&(l=d,this.light.position.set(d.x*6,d.y*6,d.z*6));const m=new gt(hn(o.color,"#fff3dd"));s?(this.light.color.copy(m.lerp(new gt(16777215),.68)),this.light.intensity=2.35):(this.light.color.copy(m),this.light.intensity=o.known?2.6:1.9)}this.ambient.intensity=s?.58:.75,this.cloudsMat.opacity=s?.4:.62;const h=co(n.tempC,n.habitability),u=n.selected||e.selection==="planet";if(h!==this.lastTone&&(this.lastTone=h,this.atmosphereMat.uniforms.uColor={value:new gt(on(h,.34))},this.anchor.color=h),this.anchor.color=h,s?this.applyNearMaterials(n,e,r):this.applyFarMaterials(h,u),this.shaderRef?.uniforms.uNightDirView){this.tmpVec.set(l.x,l.y,l.z);try{this.tmpVec.transformDirection(e.camera.matrixWorldInverse)}catch{}this.shaderRef.uniforms.uNightDirView.value.copy(this.tmpVec)}this.atmosphere.visible=s,this.glow.visible=!s,s?(this.atmosphere.scale.setScalar(r*1.045),this.atmosphereMat.uniforms.uIntensity={value:ht(.3+(n.habitability??.25)*.32,.22,.62)}):this.clouds.visible&&(this.clouds.visible=!1);const p=r*5.6;if(this.glow.scale.set(p,p,1),this.glowMat.opacity=ht(.22+(n.habitability??.2)*.26+(u?.1:0),.14,.6),this.ring.visible=u&&!s,this.ring.visible){this.ring.quaternion.copy(e.camera.quaternion);const d=r*2.8;this.ring.scale.set(d,d,1),this.ringMat.opacity=.45+.18*Math.sin(e.time*2.2)}if(!s){const d=Math.max(r*2.2,e.cameraDistance*.024);this.pick.scale.setScalar(d),this.pick.position.set(0,0,0),this.pickables.push(this.pick)}this.anchor.pos=n.pos,this.anchor.worldRadius=r}applyNearMaterials(t,e,n){const s=De.get("planet-day");if(s){if(this.dayTexture!==s){this.dayTexture=s,this.surfaceMat.map=s,this.surfaceMat.color.set("#ffffff"),this.surfaceMat.needsUpdate=!0;const o=De.get("planet-water-mask");if(this.oceanSpecularOwned){try{this.oceanSpecular?.dispose()}catch{}this.oceanSpecular=null,this.oceanSpecularOwned=!1}this.oceanSpecular=o??Hp(s.image),this.oceanSpecularOwned=!o&&!!this.oceanSpecular,this.oceanSpecular&&(this.surfaceMat.specularMap=this.oceanSpecular,this.surfaceMat.specular.set("#cfe6f4"),this.surfaceMat.shininess=52),this.textured=!0}}else this.textured&&(this.textured=!1,this.surfaceMat.map=null,this.surfaceMat.needsUpdate=!0);if(!s)this.surfaceMat.color.set(this.lastTone||co(t.tempC,t.habitability)),this.surfaceMat.emissive.set(yn(this.lastTone||Gt.planet,"#06121a",.55)),this.surfaceMat.emissiveIntensity=.2;else{this.surfaceMat.emissive.set("#ffffff"),this.surfaceMat.emissiveIntensity=.85;const o=De.get("planet-night");o?this.nightTexture!==o&&(this.nightTexture=o,this.surfaceMat.emissiveMap=o,this.surfaceMat.needsUpdate=!0):this.nightTexture&&(this.nightTexture=null,this.surfaceMat.emissiveMap=null,this.surfaceMat.needsUpdate=!0)}const r=De.get("planet-clouds"),a=n*1.012;if(r){if(this.cloudsTexture!==r){this.cloudsTexture=r,this.cloudsMat.map=r,this.cloudsMat.needsUpdate=!0;const o=kp(r);this.cloudsMat.transparent=!0,this.cloudsMat.depthWrite=!1,this.cloudsMat.blending=o?1:2,this.cloudsMat.opacity=o?.72:.45,o||this.cloudsMat.color.set("#ffffff")}this.clouds.visible=!0,this.clouds.scale.setScalar(a),this.clouds.rotation.y=e.time*.135%(Math.PI*2),this.cloudsTextured=!0}else this.clouds.visible=!1,this.cloudsTextured=!1}applyFarMaterials(t,e){(this.textured||this.dayTexture)&&(this.textured=!1,this.dayTexture=null,this.nightTexture=null,this.cloudsTexture=null,this.surfaceMat.map=null,this.surfaceMat.emissiveMap=null,this.surfaceMat.specularMap=null,this.oceanSpecular=null,this.surfaceMat.needsUpdate=!0),this.surfaceMat.color.set(t),this.surfaceMat.emissive.set(yn(t,"#06121a",.55)),this.surfaceMat.emissiveIntensity=e?.26:.16,this.surfaceMat.specular.set("#2b4a5e"),this.surfaceMat.shininess=18,this.clouds.visible=!1,this.cloudsTextured=!1}setGeometryKind(t){if(this.geometryKind===t)return;this.geometryKind=t;const e=this.geometryFor(t);this.surface.geometry=e,this.clouds.geometry=e,this.atmosphere.geometry=e}geometryFor(t){return t==="near-high"?(this.nearGeometryHigh||(this.nearGeometryHigh=new ke(1,uo[0],uo[1])),this.nearGeometryHigh):t==="near-low"?(this.nearGeometryLow||(this.nearGeometryLow=new ke(1,fo[0],fo[1])),this.nearGeometryLow):(this.farGeometry||(this.farGeometry=new ke(1,ho[0],ho[1])),this.farGeometry)}nearestStar(t,e){let n=null,s=1/0;for(let r=0;r<e.length;r++){const a=e[r];if(!a||!Number.isFinite(a.pos?.x)||!Number.isFinite(a.pos?.y)||!Number.isFinite(a.pos?.z))continue;const o=(a.pos.x-t.x)**2+(a.pos.y-t.y)**2+(a.pos.z-t.z)**2;o<s&&(s=o,n=a)}return n}dispose(){const t=[this.farGeometry,this.nearGeometryHigh,this.nearGeometryLow,this.ringGeometry,this.pickGeometry];for(const e of t)try{e?.dispose()}catch{}if(this.farGeometry=null,this.nearGeometryHigh=null,this.nearGeometryLow=null,this.pickMaterial.dispose(),this.surfaceMat.dispose(),this.cloudsMat.dispose(),this.atmosphereMat.dispose(),this.glowMat.dispose(),this.ringMat.dispose(),this.oceanSpecularOwned)try{this.oceanSpecular?.dispose()}catch{}this.oceanSpecular=null,this.oceanSpecularOwned=!1,this.shaderRef=null,this.group.clear(),this.pickables.length=0}}class jp{group=new fe;ringGeometry=new Ni(.84,1,48);visuals=new Map;usedKeys=new Set;constructor(){this.group.name="r3d-pulses"}sync(t,e){if(this.usedKeys.clear(),t)for(let n=0;n<t.length;n++){const s=t[n];s&&(!Number.isFinite(s.pos?.x)||!Number.isFinite(s.pos?.y)||!Number.isFinite(s.pos?.z)||this.syncPulse(s,e))}this.visuals.forEach((n,s)=>{this.usedKeys.has(s)||(n.group.visible=!1)})}syncPulse(t,e){const n="pulse:"+t.id,s=this.ensure(n);this.usedKeys.add(n),s.group.visible=!0,s.group.position.set(t.pos.x,t.pos.y,t.pos.z),s.group.quaternion.copy(e.camera.quaternion);const r=hn(t.color,"#ff7a5b");s.colorHex!==r&&(s.colorHex=r,s.ringMat.color.set(r),s.glowMat.map=ii(r)??null,s.glowMat.needsUpdate=!0);const a=ht(Number.isFinite(t.severity)?t.severity:.5,0,1),o=Math.max(e.cameraDistance*.018,e.viewRadius*.012)*(.7+a*.7),l=.85+.3*Math.sin(e.time*2.6+s.phase),h=o*l;s.ring.scale.set(h,h,1),s.glow.scale.set(h*2.2,h*2.2,1),s.ringMat.opacity=ht(.25+a*.5,.2,.9),s.glowMat.opacity=ht(.12+a*.3,.1,.55)}ensure(t){const e=this.visuals.get(t);if(e)return e;const n="#ff7a5b",s=new Be({color:new gt(n),transparent:!0,opacity:.5,depthWrite:!1,depthTest:!0,side:2,blending:2,toneMapped:!1}),r=new le(this.ringGeometry,s);r.frustumCulled=!1,r.renderOrder=20;const a=new Ri({map:ii(n)??null,color:new gt(16777215),transparent:!0,opacity:.2,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1}),o=new Ms(a);o.frustumCulled=!1,o.renderOrder=19;const l=new fe;l.name="r3d-"+t,l.add(r,o),this.group.add(l);const h={key:t,group:l,ring:r,ringMat:s,glow:o,glowMat:a,colorHex:"",phase:$f(t,11)*Math.PI*2};return this.visuals.set(t,h),h}dispose(){this.visuals.forEach(t=>{try{this.group.remove(t.group),t.ringMat.dispose(),t.glowMat.dispose()}catch{}}),this.visuals.clear(),this.usedKeys.clear(),this.ringGeometry.dispose(),this.group.clear()}}const dr=150,fr=1500;function Zp(i){const t=Jf(el(i+"|render3d|star-dome")),e=new Float32Array(fr*3),n=new Float32Array(fr*3),s=new gt;for(let h=0;h<fr;h++){const u=1-2*t(),p=t()*qf,d=Math.sqrt(Math.max(0,1-u*u)),m=h*3;e[m]=Math.cos(p)*d*dr,e[m+1]=u*dr,e[m+2]=Math.sin(p)*d*dr;const _=t(),g=_<.72?5200+t()*5200:_<.92?3e3+t()*2400:8200+t()*6e3;s.set(jf(g));const f=.22+Math.pow(t(),2.2)*.95;n[m]=s.r*f,n[m+1]=s.g*f,n[m+2]=s.b*f}const r=new he;r.setAttribute("position",new ce(e,3)),r.setAttribute("color",new ce(n,3));const a=nl(),o=new wr({size:1.6,sizeAttenuation:!1,transparent:!0,opacity:.9,vertexColors:!0,depthTest:!1,depthWrite:!1,blending:2,alphaTest:.01,toneMapped:!1});a&&(o.map=a);const l=new zo(r,o);return l.name="r3d-star-dome",l.frustumCulled=!1,l.renderOrder=-1e3,l}function po(i){const t=i.seed||"trisolaris",e=new fe;e.name="r3d-scene-root";const n=tp(),s=Zp(t);s&&e.add(s);const r=new fe;r.name="r3d-reference-grid";const a=new fe;a.name="r3d-axes",e.add(r,a);const o=[{label:"X",pos:Xe(1,0,0)},{label:"Y",pos:Xe(0,1,0)},{label:"Z",pos:Xe(0,0,1)}],l={baseRadius:0,gridVisible:!0,gridBuilt:!1};let h=[],u=[];function p(){for(const g of[...r.children]){r.remove(g);const f=g;try{f.geometry?.dispose?.()}catch{}}for(const g of h)try{g.dispose()}catch{}h=[]}function d(){for(const g of[...a.children]){a.remove(g);const f=g;try{f.geometry?.dispose?.()}catch{}}for(const g of u)try{g.dispose()}catch{}u=[]}function m(g,f,c){const b=new he;b.setAttribute("position",new ce(new Float32Array(g),3));const E=new cn({color:new gt(f),transparent:!0,opacity:c,depthWrite:!1,toneMapped:!1});h.push(E);const M=new _r(b,E);return M.frustumCulled=!1,M}function _(g){p(),d();const f=ht(Number.isFinite(g)?g:3,1e-4,1e6),c=f*3.4,b=Mr(c/5),E=b/5,M=[],C=[],A=(O,G,W,Z,k)=>{O.push(G,0,W,Z,0,k)},R=Math.max(2,Math.ceil(c/b));for(let O=-R;O<=R;O++){const G=O*b;if(!(Math.abs(G)>c+1e-9)){O!==0&&(A(M,G,-c,G,c),A(M,-c,G,c,G));for(let W=1;W<5;W++){const Z=G+W*E;Math.abs(Z)>c+1e-9||(A(C,Z,-c,Z,c),A(C,-c,Z,c,Z))}}}const P=m(C,Gt.grid,.055),S=m(M,Gt.grid,.14);r.add(P,S);const x=[-c,0,-c,c,0,-c,c,0,-c,c,0,c,c,0,c,-c,0,c,-c,0,c,-c,0,-c];r.add(m(x,Gt.grid,.18));const w=f*1.25,I=[{dir:Xe(1,0,0),color:Gt.axisX},{dir:Xe(0,1,0),color:Gt.axisY},{dir:Xe(0,0,1),color:Gt.axisZ}],B=Mr(w/2.6);for(let O=0;O<I.length;O++){const G=I[O],W=[0,0,0,G.dir.x*w,G.dir.y*w,G.dir.z*w],Z=Math.min(8,Math.floor(w/B)),k=f*.018;for(let Xt=1;Xt<=Z;Xt++){const q=Xt*B,Q=G.dir.x*q,xt=G.dir.y*q,it=G.dir.z*q;G.dir.y!==0?W.push(Q-k,xt,it,Q+k,xt,it):W.push(Q,xt-k,it,Q,xt+k,it)}const tt=new he;tt.setAttribute("position",new ce(new Float32Array(W),3));const lt=new cn({color:new gt(G.color),transparent:!0,opacity:.32,depthWrite:!1,toneMapped:!1});u.push(lt);const vt=new _r(tt,lt);vt.frustumCulled=!1,a.add(vt);const Lt=o[O];Lt&&(Lt.pos=Xe(G.dir.x*w*1.06,G.dir.y*w*1.06,G.dir.z*w*1.06))}l.gridBuilt=!0}return{group:e,background:n,setShowGrid(g){const f=!!g;l.gridVisible!==f&&(l.gridVisible=f,r.visible=f,a.visible=f)},setBaseRadius(g){const f=Number.isFinite(g)&&g>1e-6?g:3;(!l.gridBuilt||Math.abs(f-l.baseRadius)>Math.max(1e-6,l.baseRadius*.02))&&(l.baseRadius=f,_(f),r.visible=l.gridVisible,a.visible=l.gridVisible)},update(g){s&&s.position.copy(g.position)},axisAnchors(){return o},dispose(){if(p(),d(),s){e.remove(s);try{s.geometry.dispose()}catch{}s.material?.dispose?.()}e.remove(r,a);try{n?.dispose()}catch{}e.clear()}}}function $p(i,t){const e=Math.max(.001,Number.isFinite(t)?t:1),n=Number.isFinite(i.radiusAU)&&i.radiusAU>1e-6?i.radiusAU:no,s=ht(n/no,.02,30),r=.0045+.0028*Math.sqrt(s),a=e*r,o=n*2.4;return ht(Math.max(a,o),e*.0022,e*.075)}const Jp=11,Qp=2.8,mo=[72,48],go=[40,26];class tm{group=new fe;coreGeometry=new ke(1,24,16);nearGeometryHigh=null;nearGeometryLow=null;ringGeometry=new Ni(.9,1,56);pickGeometry=new ke(1,8,6);pickMaterial=new Be({visible:!1});visuals=new Map;anchorList=[];pickable=[];ringColor=new gt(Gt.selection);constructor(){this.group.name="r3d-stars"}anchors(){return this.anchorList}pickTargets(){return this.pickable}sync(t,e){const n=t.stars??[],s=new Set,r=e.selection,a=e.nearBody;this.anchorList.length=0,this.pickable.length=0;for(let o=0;o<n.length;o++){const l=n[o];if(!l||typeof l.id!="string")continue;const h=l.id;s.add(h);const u=a===h,p=hn(l.color,Qo(h)),d=this.ensure(h,p),m=l.selected||r===h,_=!!l.known,g=ht(Number.isFinite(l.confidence)?l.confidence:.3,0,1)*(_?1:.55),f=Number.isFinite(l.pos?.x)&&Number.isFinite(l.pos?.y)&&Number.isFinite(l.pos?.z)?l.pos:{x:0,y:0,z:0},c=u&&e.nearRadius>0?e.nearRadius:$p(l,e.cameraDistance);if(d.radius=c,d.root.visible=!a||u,!!d.root.visible){if(d.root.position.set(f.x,f.y,f.z),d.core.scale.setScalar(c),d.color!==p){d.color=p;const b=_?on(p,.18):yn(p,Gt.muted,.45);d.coreMat.color.set(b),d.glowMat.map=ii(p)??null,d.glowMat.needsUpdate=!0}if(u){this.setGeometryKind(d,e.quality==="low"?"near-low":"near-high");const b=cl(h),E=b?De.get(b):null;E?d.coreMat.map!==E&&(d.coreMat.map=E,d.coreMat.color.set("#f4e2c4"),d.coreMat.needsUpdate=!0,d.textured=!0):(d.textured||d.coreMat.map)&&(d.coreMat.map=null,d.coreMat.color.set(_?on(p,.18):yn(p,Gt.muted,.45)),d.coreMat.needsUpdate=!0,d.textured=!1),d.coreMat.opacity=_?1:.62,d.core.rotation.y=e.time*.055%(Math.PI*2);const M=ht(.42+g*.22,.2,.8)*(.94+.06*Math.sin(e.time*.7+o*1.3));d.glowMat.opacity=M;const C=c*(_?5.2:6.4);d.glow.scale.set(C,C,1),d.innerMat.opacity=ht(.42+g*.2,.2,.68);const A=c*2.15;d.inner.scale.set(A,A,1),d.ring.visible=!1}else{this.setGeometryKind(d,"far"),(d.textured||d.coreMat.map)&&(d.coreMat.map=null,d.coreMat.needsUpdate=!0,d.textured=!1),d.core.rotation.y=0,d.coreMat.color.set(_?on(p,.18):yn(p,Gt.muted,.45)),d.coreMat.opacity=_?.98:.5;const b=.9+.1*Math.sin(e.time*.8+o*1.7),E=ht((.2+g*.62)*b*(m?1.18:1),.05,1);d.glowMat.opacity=E;const M=c*Jp*(_?1:.8)*(m?1.08:1);d.glow.scale.set(M,M,1),d.glow.renderOrder=10,d.innerMat.opacity=ht(.32+g*.42,.1,.85)*(_?1:.5);const C=c*Qp;if(d.inner.scale.set(C,C,1),d.inner.renderOrder=11,d.ring.visible=m,m){d.ring.quaternion.copy(e.camera.quaternion);const A=c*2.6;d.ring.scale.set(A,A,1),d.ringMat.opacity=.4+.18*Math.sin(e.time*2.2),d.ringMat.color.copy(this.ringColor)}}if(!a){const b=Math.max(c*2,e.cameraDistance*.02);d.pick.scale.setScalar(b),d.pick.position.set(0,0,0),d.pick.userData.id=h,this.pickable.push(d.pick)}d.anchor.pos=f,d.anchor.worldRadius=c,d.anchor.color=p,d.anchor.id=h,this.anchorList.push(d.anchor)}}this.visuals.forEach((o,l)=>{s.has(l)||(o.root.visible=!1,this.disposeVisual(o),this.visuals.delete(l))})}ensure(t,e){const n=this.visuals.get(t);if(n)return n.root.visible=!0,n;const s=new fe;s.name="r3d-star-"+t;const r=new Be({color:new gt(e),transparent:!0,opacity:.98,toneMapped:!1}),a=new le(this.coreGeometry,r);a.frustumCulled=!1;const o=new Ri({map:ii(e)??null,color:new gt(16777215),transparent:!0,opacity:.8,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1}),l=new Ms(o);l.frustumCulled=!1,l.renderOrder=10;const h=new Ri({map:ii("#ffffff")??null,color:new gt(16777215),transparent:!0,opacity:.55,depthWrite:!1,blending:2,toneMapped:!1}),u=new Ms(h);u.frustumCulled=!1,u.renderOrder=11;const p=new Be({color:new gt(Gt.selection),transparent:!0,opacity:.5,depthWrite:!1,depthTest:!0,side:2,blending:2,toneMapped:!1}),d=new le(this.ringGeometry,p);d.frustumCulled=!1,d.visible=!1,d.renderOrder=12;const m=new le(this.pickGeometry,this.pickMaterial);m.visible=!0,m.frustumCulled=!1,m.userData.id=t,s.add(a,l,u,d,m),this.group.add(s);const g={root:s,core:a,coreMat:r,glow:l,glowMat:o,inner:u,innerMat:h,ring:d,ringMat:p,pick:m,anchor:{id:t,pos:{x:0,y:0,z:0},worldRadius:0,color:e},color:e,radius:0,geometryKind:"far",textured:!1};return this.visuals.set(t,g),g}setGeometryKind(t,e){t.geometryKind!==e&&(t.geometryKind=e,t.core.geometry=this.geometryFor(e))}geometryFor(t){return t==="near-high"?(this.nearGeometryHigh||(this.nearGeometryHigh=new ke(1,mo[0],mo[1])),this.nearGeometryHigh):t==="near-low"?(this.nearGeometryLow||(this.nearGeometryLow=new ke(1,go[0],go[1])),this.nearGeometryLow):this.coreGeometry}disposeVisual(t){try{this.group.remove(t.root),t.coreMat.dispose(),t.glowMat.dispose(),t.innerMat.dispose(),t.ringMat.dispose()}catch{}}dispose(){this.visuals.forEach(e=>this.disposeVisual(e)),this.visuals.clear(),this.anchorList.length=0,this.pickable.length=0,this.coreGeometry.dispose(),this.ringGeometry.dispose(),this.pickGeometry.dispose(),this.pickMaterial.dispose();const t=[];this.nearGeometryHigh&&t.push(this.nearGeometryHigh),this.nearGeometryLow&&t.push(this.nearGeometryLow);for(const e of t)try{e.dispose()}catch{}this.nearGeometryHigh=null,this.nearGeometryLow=null,this.group.clear()}}const _o=512,pr=128;function em(i,t){const e=new Float32Array(i*3),n=new ce(e,3);n.setUsage(35048);const s=new he;s.setAttribute("position",n),s.setDrawRange(0,0);let r=null;if(t){const a=new Float32Array(i);r=new ce(a,1),r.setUsage(35048),s.setAttribute("lineDistance",r)}return{geometry:s,positionAttr:n,lineDistanceAttr:r,positions:e}}class nm{group=new fe;visuals=new Map;usedKeys=new Set;tmpColor=new gt;dotTexture=nl();constructor(){this.group.name="r3d-trails"}sync(t,e,n,s){this.usedKeys.clear();const r=s.settings;if(r.showTrails&&t)for(let a=0;a<t.length;a++)t[a]&&this.syncTrail("observed:"+t[a].id,t[a],s,!1);if(r.showPrediction&&e)for(let a=0;a<e.length;a++)e[a]&&this.syncTrail("predicted:"+e[a].id,e[a],s,!0);r.showPrediction&&n&&this.syncTrail("planet:predicted",n,s,!0),this.visuals.forEach((a,o)=>{this.usedKeys.has(o)||(a.group.visible=!1,a.count=0)})}syncTrail(t,e,n,s){const r=e.points;if(!r||r.length<2)return;const a=e.dashed!==void 0?!!e.dashed:s,o=this.ensure(t,a);if(!o)return;this.usedKeys.add(t);const l=this.writePositions(o,r);if(l<2){o.group.visible=!1;return}o.group.visible=!0;const h=tl(e.id,e.color),u=ht(Number.isFinite(e.alpha)?e.alpha:.85,.04,1),p=ht(Number.isFinite(e.width)?e.width:1.4,.5,8);if(o.colorHex!==h){o.colorHex=h;const d=new gt(h);o.coreMat.color.copy(d),this.tmpColor.set(on(h,.35)),o.haloMat.color.copy(this.tmpColor),o.dotMat&&o.dotMat.color.copy(d)}if(o.coreMat.opacity=u*(s?.72:.95),o.haloMat.opacity=u*ht(.16+p*.05,.14,.42),o.core.visible=!0,o.halo.visible=!0,o.dashed){const d=Math.max(1e-6,n.viewRadius*.028),m=Math.max(1e-6,n.viewRadius*.02);if(Math.abs(o.dashRadius-n.viewRadius)>n.viewRadius*.02){o.dashRadius=n.viewRadius;const _=o.coreMat,g=o.haloMat;_.dashSize=d,_.gapSize=m,g.dashSize=d,g.gapSize=m}}if(!s&&o.dots&&o.dotGeometry&&o.dotAttr&&o.dotPositions){const d=Math.max(1,Math.floor(l/pr));let m=0;for(let _=0;_<l&&m<pr;_+=d){const g=_*3,f=m*3;o.dotPositions[f]=o.positions[g],o.dotPositions[f+1]=o.positions[g+1],o.dotPositions[f+2]=o.positions[g+2],m++}o.dotAttr.needsUpdate=!0,o.dotGeometry.setDrawRange(0,m),o.dots.visible=m>1,o.dotMat&&(o.dotMat.opacity=u*.32)}else o.dots&&(o.dots.visible=!1)}writePositions(t,e){const n=Wo(e,_o),s=t.positions;let r=0;for(let a=0;a<n.length;a++){const o=n[a];if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y)||!Number.isFinite(o.z))continue;const l=r*3;s[l]=o.x,s[l+1]=o.y,s[l+2]=o.z,r++}if(t.count=r,r<2)return t.geometry.setDrawRange(0,0),r;if(t.geometry.setDrawRange(0,r),t.positionAttr.needsUpdate=!0,t.dashed&&t.lineDistanceAttr){const a=t.lineDistanceAttr.array;Wf(s,r,a),t.lineDistanceAttr.needsUpdate=!0}return r}ensure(t,e){const n=this.visuals.get(t);if(n){if(n.dashed===e)return n;this.disposeVisual(n),this.visuals.delete(t)}const s=_o,{geometry:r,positionAttr:a,lineDistanceAttr:o,positions:l}=em(s,e),h=new gt(16777215),u={color:h,transparent:!0,opacity:.8,depthWrite:!1,toneMapped:!1},p=e?new ja({...u,dashSize:.1,gapSize:.06,scale:1}):new cn(u),d=e?new ja({...u,color:h.clone(),opacity:.25,dashSize:.1,gapSize:.06,scale:1,blending:2}):new cn({...u,color:h.clone(),opacity:.25,blending:2}),m=new Ci(r,p);m.frustumCulled=!1,m.renderOrder=6;const _=new Ci(r,d);_.frustumCulled=!1,_.renderOrder=5;const g=new fe;g.name="r3d-trail-"+t,g.add(m,_);let f=null,c=null,b=null,E=null,M=null;e||(b=new Float32Array(pr*3),E=new ce(b,3),E.setUsage(35048),c=new he,c.setAttribute("position",E),c.setDrawRange(0,0),M=new wr({map:this.dotTexture??void 0,color:h.clone(),size:2.4,sizeAttenuation:!1,transparent:!0,opacity:.3,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1}),f=new zo(c,M),f.frustumCulled=!1,f.renderOrder=7,g.add(f)),this.group.add(g);const C={key:t,dashed:e,group:g,geometry:r,positionAttr:a,lineDistanceAttr:o,positions:l,core:m,halo:_,coreMat:p,haloMat:d,dots:f,dotGeometry:c,dotPositions:b,dotAttr:E,dotMat:M,colorHex:"",count:0,dashRadius:-1};return this.visuals.set(t,C),C}disposeVisual(t){try{this.group.remove(t.group),t.geometry.dispose(),t.coreMat.dispose(),t.haloMat.dispose(),t.dotGeometry&&t.dotGeometry.dispose(),t.dotMat&&t.dotMat.dispose()}catch{}}dispose(){this.visuals.forEach(t=>this.disposeVisual(t)),this.visuals.clear(),this.usedKeys.clear(),this.group.clear()}}class im{group=new fe;sphereGeometry=new ke(1,24,16);visuals=new Map;usedKeys=new Set;constructor(){this.group.name="r3d-uncertainty"}sync(t,e,n){if(this.usedKeys.clear(),n.settings.showUncertainty){if(t){for(let s=0;s<t.length;s++)if(t[s]){const r=!!n.selection&&bs(t[s].id)===n.selection;this.syncCloud("star:"+t[s].id,t[s],n,r)}}e&&this.syncCloud("planet",e,n,n.selection==="planet")}this.visuals.forEach((s,r)=>{this.usedKeys.has(r)||(s.group.visible=!1)})}syncCloud(t,e,n,s){const r=Number.isFinite(e.radiusAU)?e.radiusAU:0;if(!(r>0)||!Number.isFinite(e.center?.x)||!Number.isFinite(e.center?.y)||!Number.isFinite(e.center?.z))return;const a=this.ensure(t);this.usedKeys.add(t),a.group.visible=!0,a.group.position.set(e.center.x,e.center.y,e.center.z),a.group.scale.setScalar(r);const o=hn(e.color,"#4fa8ff");a.colorHex!==o&&(a.colorHex=o,a.shellMat.color.set(o),a.wireMat.color.set(on(o,.3)));const l=ht(Number.isFinite(e.alpha)?e.alpha:.35,0,1);a.shellMat.opacity=ht(.05+l*.26,.035,.4)*(s?1.9:1),a.wireMat.opacity=ht(.02+l*.14,.012,.22)*(s?1.7:1)}ensure(t){const e=this.visuals.get(t);if(e)return e;const n="#4fa8ff",s=new Be({color:new gt(n),transparent:!0,opacity:.12,depthWrite:!1,depthTest:!0,side:2,blending:2,toneMapped:!1}),r=new le(this.sphereGeometry,s);r.frustumCulled=!1,r.renderOrder=4;const a=new Be({color:new gt(n),transparent:!0,opacity:.06,depthWrite:!1,depthTest:!0,wireframe:!0,blending:2,toneMapped:!1}),o=new le(this.sphereGeometry,a);o.frustumCulled=!1,o.renderOrder=5;const l=new fe;l.name="r3d-cloud-"+t,l.add(r,o),this.group.add(l);const h={key:t,group:l,shell:r,wire:o,shellMat:s,wireMat:a,colorHex:""};return this.visuals.set(t,h),h}dispose(){this.visuals.forEach(t=>{try{this.group.remove(t.group),t.shellMat.dispose(),t.wireMat.dispose()}catch{}}),this.visuals.clear(),this.usedKeys.clear(),this.sphereGeometry.dispose(),this.group.clear()}}const sm=2,xo=45e5,rm=6,am=90,vo=8,Mo=3,om=640,lm=360,cm=.5;function hm(i){try{const t=i.getContext();if(!t)return!1;let e="";const n=t.getExtension("WEBGL_debug_renderer_info");return n&&(e=String(t.getParameter(n.UNMASKED_RENDERER_WEBGL)??"")),e||(e=String(t.getParameter(t.RENDERER)??"")),/swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i.test(e)}catch{return!1}}let xs=null;function fm(){const i=xs;return!i||i.isDisposed()?null:i.debugState()}function yo(){return typeof performance<"u"&&typeof performance.now=="function"?performance.now():Date.now()}function um(i){return typeof i=="string"&&i.length>0?i:"trisolaris"}function dm(){if(typeof document>"u"||typeof document.createElement!="function")return!1;try{const i=document.createElement("canvas");return typeof i.getContext!="function"?!1:!!(i.getContext("webgl2")??i.getContext("webgl"))}catch{return!1}}let ms=0;class zr{container;canvas;renderer;scene=new Rf;orbit=new vp;stars=new tm;planet=new Kp;trails=new nm;clouds=new im;orbitPlanes=new Np;pulses=new jp;distanceLines=new Mp;picker=new Bp;labels;hud;onPick;sceneRoot;listeners=[];resizeObserver=null;idleRafId=0;lastFrameAt=0;time=0;frameCount=0;failures=0;dead=!1;disposed=!1;contextLost=!1;resizeWarned=!1;width=om;height=lm;dpr=1;seed;preset="free";lastScene=null;lastBaseRadius=Mo;containerPositionRestore=null;nearBody=null;nearSurfaceRadius=0;nearArmed=!1;quality="high";fpsValue=0;fpsFrames=0;fpsElapsed=0;textureUnsubscribe=null;frameContext;pairPool=[];pairView;anchorView=[];pickTargets=[];selectionPos={x:0,y:0,z:0};pointers=new Map;dragMode="none";dragMoved=0;pinchDistance=0;constructor(t){this.container=t.container,this.seed=um(t.seed),this.onPick=typeof t.onPick=="function"?t.onPick:void 0;const e=this.container.ownerDocument??document;this.canvas=e.createElement("canvas"),this.canvas.style.cssText="position:absolute;left:0;top:0;width:100%;height:100%;display:block;outline:none;touch-action:none;cursor:grab;",this.container.appendChild(this.canvas),this.adjustContainerPosition(e);let n=null;try{n=new wf({canvas:this.canvas,antialias:!0,alpha:!1,depth:!0,stencil:!1,powerPreference:"high-performance"})}catch(s){try{this.canvas.remove()}catch{try{this.container.removeChild(this.canvas)}catch{}}throw s}this.renderer=n;try{this.renderer.setClearColor(new gt(Gt.void),1),this.renderer.setPixelRatio(1),this.renderer.outputColorSpace=Te}catch{}this.sceneRoot=po({seed:this.seed}),this.scene.background=this.sceneRoot.background,this.scene.add(this.sceneRoot.group,this.stars.group,this.planet.group,this.trails.group,this.clouds.group,this.orbitPlanes.group,this.pulses.group,this.distanceLines.group),this.quality=hm(this.renderer)?"low":"high";try{De.setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy())}catch{}this.textureUnsubscribe=De.onChange(()=>this.requestIdleRedraw()),this.labels=Pp(this.container),this.hud=Sp(this.container,{onExitNear:()=>this.exitNearView("button"),onSelectBody:s=>this.requestNear(s,!0)});for(let s=0;s<vo;s++)this.pairPool.push({from:{x:0,y:0,z:0},to:{x:0,y:0,z:0},mid:{x:0,y:0,z:0},distanceAU:0,deltaHeightAU:null,color:Gt.distance});this.pairView={items:this.pairPool,count:0},this.frameContext={camera:this.orbit.camera,width:this.width,height:this.height,time:0,viewRadius:Mo,cameraDistance:this.orbit.cameraDistance,settings:lo,selection:null,heightDataAvailable:!1,nearBody:null,nearRadius:0,quality:this.quality},ms+=1,xs=this;try{this.canvas.__trisolarisR3D={state:()=>this.debugState(),project:s=>this.debugState().project(s)}}catch{}this.bindEvents(),this.resize();try{this.renderer.render(this.scene,this.orbit.camera)}catch{}}resize(){if(!this.disposed)try{this.applyViewport(!0)}catch(t){this.resizeWarned||(this.resizeWarned=!0,console.warn("[render3d] 画布尺寸同步失败：",t))}}destroy(){if(this.disposed)return;if(this.disposed=!0,this.dead=!0,this.detachEvents(),this.resizeObserver){try{this.resizeObserver.disconnect()}catch{}this.resizeObserver=null}if(this.idleRafId!==0&&typeof cancelAnimationFrame=="function")try{cancelAnimationFrame(this.idleRafId)}catch{}this.idleRafId=0;const t=e=>{try{e()}catch{}};t(()=>this.stars.dispose()),t(()=>this.planet.dispose()),t(()=>this.trails.dispose()),t(()=>this.clouds.dispose()),t(()=>this.orbitPlanes.dispose()),t(()=>this.pulses.dispose()),t(()=>this.distanceLines.dispose()),t(()=>this.picker.dispose()),t(()=>this.labels?.dispose()),t(()=>this.hud?.dispose()),this.scene.background=null,t(()=>this.sceneRoot.dispose()),t(()=>this.scene.clear()),t(()=>this.renderer.dispose()),t(()=>{this.renderer.forceContextLoss?.()});try{this.canvas.remove()}catch{try{this.container.removeChild(this.canvas)}catch{}}if(this.containerPositionRestore!==null)try{this.container.style.position=this.containerPositionRestore}catch{}if(this.lastScene=null,this.anchorView.length=0,this.pickTargets.length=0,this.pairView.count=0,this.pointers.clear(),this.nearBody=null,this.nearSurfaceRadius=0,this.nearArmed=!1,this.textureUnsubscribe){try{this.textureUnsubscribe()}catch{}this.textureUnsubscribe=null}xs===this&&(xs=null),ms=Math.max(0,ms-1),ms===0&&(ep(),Wp())}frame(t,e){if(!(this.disposed||this.dead)&&!(!t||!Array.isArray(t.stars)))try{this.renderScene(t,e)}catch(n){this.failures+=1,this.failures===1&&console.warn("[render3d] 帧渲染异常，进入降级保护：",n),this.failures>=rm&&(this.dead=!0,console.warn("[render3d] 连续帧渲染失败，3D 视图停止绘制（模拟与 2D 视图不受影响）"))}}resetView(){if(!this.disposed){if(this.nearBody){this.exitNearView("reset"),this.preset="free";return}this.orbit.reset(),this.preset="free",this.requestIdleRedraw()}}setViewPreset(t){this.disposed||t!=="top"&&t!=="side"&&t!=="free"||(this.nearBody&&this.clearNearState(),this.orbit.setPreset(t),this.preset=t,this.requestIdleRedraw())}renderScene(t,e){const n=yo(),s=ht(Number.isFinite(e)?e:.016,0,.1);if(this.time+=s,this.frameCount+=1,this.frameCount%20===0)try{this.applyViewport(!1)}catch{}t.seed&&t.seed!==this.seed&&this.rebuildForSeed(t.seed),this.lastScene=t;const r=Number.isFinite(t.recommendedRadiusAU)&&t.recommendedRadiusAU>1e-6?t.recommendedRadiusAU:this.lastBaseRadius;this.lastBaseRadius=r,this.orbit.setBaseRadius(r),this.orbit.update(s);const a=t.settings??lo;if(this.syncNearSelection(t),this.nearBody){const p=this.findBodyPos(t,this.nearBody);p&&this.orbit.trackNearTarget(p)}const o=this.frameContext;o.camera=this.orbit.camera,o.width=this.width,o.height=this.height,o.time=this.time,o.viewRadius=r,o.cameraDistance=this.orbit.cameraDistance,o.settings=a,o.selection=t.selection??null,o.heightDataAvailable=!!t.heightDataAvailable,o.nearBody=this.nearBody,o.nearRadius=this.nearBody?this.nearSurfaceRadius:0,o.quality=this.quality;const l=this.nearBody!==null;l||(this.sceneRoot.setBaseRadius(r),this.sceneRoot.setShowGrid(a.showGrid),this.sceneRoot.update(this.orbit.camera)),this.applyNearVisibility(l),this.stars.sync(t,o),this.planet.sync(t,o),l||(this.trails.sync(t.observedTrails,t.predictedTrails,t.predictedPlanetTrail,o),this.clouds.sync(t.uncertaintyClouds,t.planetUncertainty,o),this.orbitPlanes.sync(t,o),this.pulses.sync(t.pulses,o)),this.anchorView.length=0;const h=this.stars.anchors();for(let p=0;p<h.length;p++)this.anchorView.push(h[p]);const u=this.planet.anchorOrNull();if(u&&this.anchorView.push(u),this.pickTargets.length=0,!l){const p=this.stars.pickTargets();for(let d=0;d<p.length;d++)this.pickTargets.push(p[d]);for(let d=0;d<this.planet.pickables.length;d++)this.pickTargets.push(this.planet.pickables[d])}if(!l){const p=this.computeSelectionPos(t,o.selection);this.buildDistancePairs(t,o,p),this.distanceLines.sync(this.pairView,p,o)}this.labels?.sync(t,o,this.anchorView,this.pairView,this.sceneRoot.axisAnchors(),p=>this.orbitPlanes.inclinationDeg(p)),this.hud?.sync(t,o,this.preset,this.buildNearHudView(t),this.hudPerf()),this.contextLost||this.renderer.render(this.scene,this.orbit.camera),this.updateFps(s),this.lastFrameAt=n}rebuildForSeed(t){this.seed=t;const e=this.sceneRoot;this.scene.background=null;try{this.scene.remove(e.group)}catch{}try{e.dispose()}catch{}this.sceneRoot=po({seed:t,baseRadius:this.lastBaseRadius}),this.scene.background=this.sceneRoot.background,this.scene.add(this.sceneRoot.group)}static isBodyId(t){return t==="A"||t==="B"||t==="C"||t==="planet"}requestNear(t,e){if(this.disposed||this.dead)return!1;const n=this.lastScene;if(!n)return!1;const s=this.findBodyPos(n,t);if(!s)return!1;if(this.nearBody===t)return e&&n.selection!==t&&this.onPick?.(t),!0;const r=rp(t,this.lastBaseRadius),a=ap(n,t,this.orbit.presetOrientation.theta,this.orbit.presetOrientation.phi);return this.nearBody=t,this.nearSurfaceRadius=r,this.nearArmed=!1,this.orbit.enterNear(s,r,a),De.requestForBody(t),this.applyNearVisibility(!0),e&&this.onPick?.(t),this.requestIdleRedraw(),!0}exitNearView(t){this.nearBody&&(this.nearBody=null,this.nearSurfaceRadius=0,this.nearArmed=!1,this.orbit.exitNear(),this.applyNearVisibility(!1),t==="blank"&&this.onPick?.(null),this.requestIdleRedraw())}clearNearState(){this.nearBody=null,this.nearSurfaceRadius=0,this.nearArmed=!1,this.applyNearVisibility(!1)}applyNearVisibility(t){const e=!t;this.sceneRoot.group.visible=e,this.trails.group.visible=e,this.clouds.group.visible=e,this.orbitPlanes.group.visible=e,this.pulses.group.visible=e,this.distanceLines.group.visible=e}isClickOnNearBody(t,e){const n=this.lastScene,s=this.nearBody;if(!n||!s)return!1;const r=this.findBodyPos(n,s);if(!r)return!1;let a;try{const d=typeof this.canvas.getBoundingClientRect=="function"?this.canvas.getBoundingClientRect():null;a=d?{left:d.left,top:d.top}:{left:0,top:0}}catch{a={left:0,top:0}}const o=ei(this.orbit.camera,r,this.width,this.height);if(!o.visible)return!1;const l=a.left+o.x,h=a.top+o.y;let u=0;try{u=this.nearSurfaceRadius*qo(this.orbit.camera,r,this.height)}catch{u=0}const p=Math.max(26,u*1.08);return Math.hypot(t-l,e-h)<=p}syncNearSelection(t){const e=this.nearBody;if(!e)return;const n=t.selection??null;if(!this.nearArmed){(n===e||n===null)&&(this.nearArmed=!0);return}if(n!==e){if(n===null){this.exitNearView("external");return}zr.isBodyId(n)&&this.requestNear(n,!1)}}buildNearHudView(t){const e=this.nearBody;if(!e)return null;const n=lp(t,e,!!t.heightDataAvailable);return n?{info:n,zoom:this.orbit.zoomRange,textures:this.textureStats()}:null}textureStats(){const t=De.loadedCount();return{loaded:t.loaded,pending:t.pending,total:t.total,states:De.snapshot()}}hudPerf(){return{fps:this.fpsValue,quality:this.quality,textures:this.textureStats()}}updateFps(t){const e=Number.isFinite(t)&&t>0?t:0;this.fpsFrames+=1,this.fpsElapsed+=e,this.fpsElapsed>=cm&&(this.fpsValue=this.fpsElapsed>0?this.fpsFrames/this.fpsElapsed:0,this.fpsFrames=0,this.fpsElapsed=0)}debugState(){const t=this.lastScene,e=(()=>{try{return(typeof this.canvas.getBoundingClientRect=="function"?this.canvas.getBoundingClientRect():null)??{left:0,top:0,width:this.width,height:this.height}}catch{return{left:0,top:0,width:this.width,height:this.height}}})(),n=s=>{if(!s)return null;const r=ei(this.orbit.camera,s,this.width,this.height);return{x:e.left+r.x,y:e.top+r.y,visible:r.visible}};return{near:this.nearBody,nearRadius:this.nearSurfaceRadius,quality:this.quality,camera:{mode:this.orbit.isNear?"near":"orbit",distance:this.orbit.cameraDistance,min:this.orbit.zoomRange.min,max:this.orbit.zoomRange.max,moving:this.orbit.isMoving,transitioning:this.orbit.isTransitioning},textures:De.snapshot(),renderer:{frames:this.frameCount,fps:this.fpsValue},project:s=>n(t?this.findBodyPos(t,s):null)}}isDisposed(){return this.disposed}computeSelectionPos(t,e){const n=this.selectionPos;if(!e)return null;if(e==="planet"){const s=t.planet;return!s||!Number.isFinite(s.pos?.x)||!Number.isFinite(s.pos?.y)||!Number.isFinite(s.pos?.z)?null:(n.x=s.pos.x,n.y=s.pos.y,n.z=s.pos.z,n)}for(let s=0;s<t.stars.length;s++){const r=t.stars[s];if(r.id===e)return!Number.isFinite(r.pos?.x)||!Number.isFinite(r.pos?.y)||!Number.isFinite(r.pos?.z)?null:(n.x=r.pos.x,n.y=r.pos.y,n.z=r.pos.z,n)}return null}buildDistancePairs(t,e,n){const s=this.pairView;if(s.count=0,!e.selection||!n||!e.settings.showLabels)return;let r=0;const a=(o,l,h)=>{if(r>=s.items.length||r>=vo)return;const u=s.items[r];u.from.x=n.x,u.from.y=n.y,u.from.z=n.z,u.to.x=o.x,u.to.y=o.y,u.to.z=o.z;const p=Hf(n,o);u.mid.x=p.x,u.mid.y=p.y,u.mid.z=p.z,u.distanceAU=Vf(n,o),u.deltaHeightAU=e.heightDataAvailable?h:null,u.color=l,r+=1};for(let o=0;o<t.stars.length;o++){const l=t.stars[o];!l||l.id===e.selection||!Number.isFinite(l.pos?.x)||!Number.isFinite(l.pos?.y)||!Number.isFinite(l.pos?.z)||a(l.pos,hn(l.color,Gt.accent),l.pos.y-n.y)}if(e.selection!=="planet"&&t.planet){const o=t.planet;Number.isFinite(o.pos?.x)&&Number.isFinite(o.pos?.y)&&Number.isFinite(o.pos?.z)&&a(o.pos,Gt.planet,o.pos.y-n.y)}s.count=r}applyViewport(t){const e=this.measureSize(),n=this.computeDpr(e.width,e.height);!t&&e.width===this.width&&e.height===this.height&&Math.abs(n-this.dpr)<.001||(this.width=e.width,this.height=e.height,this.dpr=n,this.renderer.setPixelRatio(n),this.renderer.setSize(e.width,e.height,!1),this.orbit.setViewport(e.width,e.height),this.orbit.update(0),this.lastScene&&this.requestIdleRedraw())}measureSize(){const t=this.container;let e=0,n=0;try{e=t.clientWidth||0,n=t.clientHeight||0}catch{e=0,n=0}if(e<2||n<2)try{const s=typeof t.getBoundingClientRect=="function"?t.getBoundingClientRect():null;s&&(e=s.width,n=s.height)}catch{}return(!(e>=2)||!(n>=2))&&(e=this.width,n=this.height),{width:Math.max(2,Math.floor(e)),height:Math.max(2,Math.floor(n))}}computeDpr(t,e){let n=1;return typeof window<"u"&&Number.isFinite(window.devicePixelRatio)&&window.devicePixelRatio>0&&(n=window.devicePixelRatio),n=ht(n,1,sm),t*e*n*n>xo&&(n=Math.max(1,Math.sqrt(xo/Math.max(1,t*e)))),Math.round(n*100)/100}handleWheel=t=>{if(this.disposed)return;try{typeof t.preventDefault=="function"&&t.preventDefault()}catch{}const e=Number.isFinite(t.deltaY)?t.deltaY:0,n=t.deltaMode===1?e*16:t.deltaMode===2?e*this.height:e;this.orbit.zoomBy(ht(Math.exp(-n*.0012),.2,5)),this.requestIdleRedraw()};handlePointerDown=t=>{if(this.disposed)return;const e=typeof t.button=="number"?t.button:0;if(!(e!==0&&e!==1&&e!==2)){try{typeof t.preventDefault=="function"&&e!==0&&t.preventDefault()}catch{}this.pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this.dragMoved=0,this.pointers.size>=2?(this.dragMode="pinch",this.pinchDistance=this.currentPinchDistance()):this.dragMode=e===0&&!t.shiftKey?"rotate":"pan";try{typeof this.canvas.setPointerCapture=="function"&&this.canvas.setPointerCapture(t.pointerId)}catch{}this.setCursor(this.dragMode==="pan"?"move":"grabbing")}};handlePointerMove=t=>{if(this.disposed)return;const e=this.pointers.get(t.pointerId);if(!e){this.pointers.size===0&&this.updateHoverCursor(t.clientX,t.clientY);return}this.pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const n=t.clientX-e.x,s=t.clientY-e.y;if(this.dragMoved+=Math.abs(n)+Math.abs(s),this.dragMode==="pinch"||this.pointers.size>=2){const r=this.currentPinchDistance();this.pinchDistance>.5&&r>.5&&(this.orbit.zoomBy(ht(r/this.pinchDistance,.5,2)),this.requestIdleRedraw()),this.pinchDistance=r;return}this.dragMode==="rotate"?(this.orbit.rotateByPixels(n,s),this.preset="free",this.requestIdleRedraw()):this.dragMode==="pan"&&(this.orbit.panByPixels(n,s),this.requestIdleRedraw())};handlePointerUp=t=>{if(this.disposed||!this.pointers.has(t.pointerId))return;const n=this.dragMode==="rotate"&&this.dragMoved<=4;this.pointers.delete(t.pointerId),this.pinchDistance=this.pointers.size>=2?this.currentPinchDistance():0,this.pointers.size===0?(this.dragMode="none",this.setCursor("grab")):this.pointers.size===1&&(this.dragMode="rotate");try{typeof this.canvas.releasePointerCapture=="function"&&this.canvas.hasPointerCapture?.(t.pointerId)&&this.canvas.releasePointerCapture(t.pointerId)}catch{}if(n){const s=this.pickAt(t.clientX,t.clientY);this.nearBody?s&&s!==this.nearBody?this.requestNear(s,!0):!s&&!this.isClickOnNearBody(t.clientX,t.clientY)&&this.exitNearView("blank"):(this.onPick?.(s),s&&this.requestNear(s,!1))}};handlePointerCancel=t=>{this.pointers.delete(t.pointerId),this.pinchDistance=0,this.pointers.size===0&&(this.dragMode="none",this.setCursor("grab"))};handlePointerLeave=()=>{this.pointers.size>0||this.setCursor("grab")};handleDoubleClick=t=>{if(this.disposed||this.nearBody)return;try{typeof t.preventDefault=="function"&&t.preventDefault()}catch{}const e=this.lastScene;if(!e)return;const s=this.pickAt(t.clientX,t.clientY)??e.selection??null;if(!s){this.resetView();return}const r=this.findBodyPos(e,s);if(!r){this.resetView();return}const a=Math.max(.02,this.lastBaseRadius*(s==="planet"?.32:.38));this.orbit.focus(r,a),this.requestIdleRedraw()};handleContextMenu=t=>{try{typeof t.preventDefault=="function"&&t.preventDefault()}catch{}};handleWindowResize=()=>{this.resize()};handleWindowKeyDown=t=>{if(this.disposed||!this.nearBody||t.key!=="Escape"&&t.code!=="Escape")return;const e=t.target,n=e?.tagName??"";if(!(n==="INPUT"||n==="TEXTAREA"||n==="SELECT"||e?.isContentEditable)){try{typeof t.preventDefault=="function"&&t.preventDefault(),typeof t.stopImmediatePropagation=="function"&&t.stopImmediatePropagation()}catch{}this.exitNearView("esc")}};handleContextLost=t=>{try{typeof t.preventDefault=="function"&&t.preventDefault()}catch{}this.contextLost=!0};handleContextRestored=()=>{this.contextLost=!1,this.requestIdleRedraw()};pickAt(t,e){if(this.pickTargets.length===0)return null;let n;try{const s=typeof this.canvas.getBoundingClientRect=="function"?this.canvas.getBoundingClientRect():null;n=s?{left:s.left,top:s.top,width:s.width,height:s.height}:{left:0,top:0,width:this.width,height:this.height}}catch{n={left:0,top:0,width:this.width,height:this.height}}return this.picker.pick(t,e,n,this.orbit.camera,this.pickTargets)}findBodyPos(t,e){if(!e)return null;if(e==="planet"){const n=t.planet;return!n||!Number.isFinite(n.pos?.x)||!Number.isFinite(n.pos?.y)||!Number.isFinite(n.pos?.z)?null:n.pos}for(let n=0;n<t.stars.length;n++){const s=t.stars[n];if(s.id===e)return!Number.isFinite(s.pos?.x)||!Number.isFinite(s.pos?.y)||!Number.isFinite(s.pos?.z)?null:s.pos}return null}updateHoverCursor(t,e){const n=this.pickAt(t,e);this.setCursor(n?"pointer":"grab")}setCursor(t){try{this.canvas.style.cursor!==t&&(this.canvas.style.cursor=t)}catch{}}currentPinchDistance(){if(this.pointers.size<2)return 0;const t=[];return this.pointers.forEach(e=>t.push(e)),t.length<2?0:Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)}requestIdleRedraw(){this.disposed||this.dead||this.idleRafId!==0||typeof requestAnimationFrame=="function"&&(yo()-this.lastFrameAt<am||this.scheduleIdleFrame())}scheduleIdleFrame(){this.disposed||this.dead||this.idleRafId!==0||typeof requestAnimationFrame=="function"&&(this.idleRafId=requestAnimationFrame(()=>{this.idleRafId=0,!(this.disposed||this.dead||!this.lastScene)&&(this.frame(this.lastScene,.016),this.needsAnimation()&&this.scheduleIdleFrame())}))}needsAnimation(){return this.disposed||this.dead?!1:!!(this.orbit.isMoving||this.orbit.isTransitioning||this.nearBody&&De.loadedCount().pending>0)}adjustContainerPosition(t){try{const e=t.defaultView;if(!e||typeof e.getComputedStyle!="function")return;const n=e.getComputedStyle(this.container);n&&n.position==="static"&&(this.containerPositionRestore=this.container.style.position||"",this.container.style.position="relative")}catch{}}listen(t,e,n,s){try{t.addEventListener(e,n,s),this.listeners.push({target:t,type:e,handler:n,options:s})}catch{}}bindEvents(){if(this.listen(this.canvas,"wheel",this.handleWheel,{passive:!1}),this.listen(this.canvas,"pointerdown",this.handlePointerDown),this.listen(this.canvas,"pointermove",this.handlePointerMove),this.listen(this.canvas,"pointerup",this.handlePointerUp),this.listen(this.canvas,"pointercancel",this.handlePointerCancel),this.listen(this.canvas,"pointerleave",this.handlePointerLeave),this.listen(this.canvas,"dblclick",this.handleDoubleClick),this.listen(this.canvas,"contextmenu",this.handleContextMenu),this.listen(this.canvas,"webglcontextlost",this.handleContextLost),this.listen(this.canvas,"webglcontextrestored",this.handleContextRestored),typeof window<"u"&&(this.listen(window,"resize",this.handleWindowResize),this.listen(window,"keydown",this.handleWindowKeyDown,{capture:!0})),typeof ResizeObserver<"u")try{this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(this.container)}catch{this.resizeObserver=null}}detachEvents(){for(let t=0;t<this.listeners.length;t++){const e=this.listeners[t];try{e.target.removeEventListener(e.type,e.handler,e.options)}catch{}}this.listeners.length=0}}function gs(){return{resize(){},frame(){},destroy(){},resetView(){},setViewPreset(){}}}function pm(i){try{return!i||!i.container||typeof document>"u"?gs():dm()?new zr(i):(console.warn("[render3d] WebGL 不可用，3D 视图使用空实现（2D 视图与模拟不受影响）"),gs())}catch(t){return console.warn("[render3d] 渲染器初始化失败，使用空实现：",t),gs()}}export{gs as createNoopRenderer3D,pm as createRenderer3D,pm as default,fm as getRenderer3DDebug,dm as isWebGLAvailable};
