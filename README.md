# Tiny stack VM

Exact implementation of make.fun's tiny stack ISA v1 in Node 22, stdlib only.
32-bit wrapping arithmetic, 256-value stack, 64-deep call stack, 256 words
of memory, all traps (2-11) with their own exit codes, 1,000,000 step and
65,536 byte output limits. Run: `node main.ts` with `/input/<id>/` programs.
