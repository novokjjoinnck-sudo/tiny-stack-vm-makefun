// Tiny stack VM: exact implementation of make.fun tiny stack ISA v1
// (kit generator/subject/ISA.md, reference generator/subject/vm.mjs).
// 32-bit wrapping ints, 256-value stack, 64-deep call stack, 256 memory
// words, traps 2-11 with own exit codes, 1e6 step / 65536 byte limits.
// Node 22, stdlib only, deterministic.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const IMM = new Uint8Array(256), POPS = new Uint8Array(256), PUSH = new Uint8Array(256), KNOWN = new Uint8Array(256);
const def = (op: number, imm: number, pops: number, push: number): void => { KNOWN[op] = 1; IMM[op] = imm; POPS[op] = pops; PUSH[op] = push; };
def(0, 0, 0, 0); def(1, 1, 0, 1); def(2, 4, 0, 1); def(3, 0, 1, 0); def(4, 0, 1, 2); def(5, 0, 2, 2); def(6, 0, 2, 3); def(7, 0, 3, 3);
def(16, 0, 2, 1); def(17, 0, 2, 1); def(18, 0, 2, 1); def(19, 0, 2, 1); def(20, 0, 2, 1); def(21, 0, 2, 1); def(22, 0, 2, 1);
def(23, 0, 1, 1); def(24, 0, 2, 1); def(25, 0, 2, 1); def(26, 0, 2, 1); def(27, 0, 1, 1); def(28, 0, 2, 1); def(29, 0, 2, 1);
def(30, 0, 2, 1); def(31, 0, 2, 1); def(32, 0, 2, 1); def(33, 0, 2, 1); def(34, 0, 2, 1);
def(48, 2, 0, 0); def(49, 2, 1, 0); def(50, 2, 1, 0); def(51, 2, 0, 0); def(52, 0, 0, 0);
def(64, 0, 1, 1); def(65, 0, 2, 0); def(80, 0, 1, 0); def(81, 0, 1, 0); def(82, 0, 0, 1); def(83, 0, 1, 0);
const enc = new TextEncoder();
function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), out = new Uint8Array(65536);
  let sp = 0, csp = 0, pc = 0, steps = 0, ip = 0, olen = 0;
  const fin = (code: number) => ({ out: out.slice(0, olen), code });
  for (;;) {
    if (steps === 1000000) return fin(10);
    if (pc < 0 || pc >= n) return fin(9);
    const op = p[pc];
    if (!KNOWN[op]) return fin(5);
    const imm = IMM[op];
    if (pc + imm >= n) return fin(9);
    steps++;
    const next = pc + 1 + imm, pops = POPS[op];
    if (sp < pops) return fin(2);
    if (sp - pops + PUSH[op] > 256) return fin(3);
    pc = next;
    switch (op) {
      case 0: return fin(0);
      case 1: D[sp++] = (p[next - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[next - 4] | (p[next - 3] << 8) | (p[next - 2] << 16) | (p[next - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26: case 28: case 29: case 30: case 31: case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (b === 0) return fin(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (b === 0) return fin(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (b === 0) return fin(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (b === 0) return fin(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; D[sp++] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[next - 2] | (p[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = next + rel;
        break;
      }
      case 51:
        if (csp === 64) return fin(7);
        C[csp++] = next; pc = p[next - 2] | (p[next - 1] << 8);
        break;
      case 52:
        if (csp === 0) return fin(8);
        pc = C[--csp];
        break;
      case 64: { const addr = D[sp - 1]; if (addr < 0 || addr >= 256) return fin(6); D[sp - 1] = M[addr]; break; }
      case 65: { const addr = D[sp - 1], v = D[sp - 2]; if (addr < 0 || addr >= 256) return fin(6); sp -= 2; M[addr] = v; break; }
      case 80: {
        const bytes = enc.encode(String(D[sp - 1]));
        if (olen + bytes.length > 65536) return fin(11);
        sp--; out.set(bytes, olen); olen += bytes.length;
        break;
      }
      case 81:
        if (olen + 1 > 65536) return fin(11);
        out[olen++] = D[--sp] & 255;
        break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return fin(D[--sp] & 255);
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
