---
layout: post
title: "Our paper was accepted to MICRO’55"
comments: true
description: "Announcement about our paper acceptance"
keywords: "paper, acceptance, MICRO’55"
---

# My first paper was accepted to MICRO'55!
This paper is my first work on co-designing for security and reliability.
However, the benefit we never mention in the paper itself is its great
pedagogical value. Any college book on computer architecture teaches
error-correcting codes using Hamming or BCH codes as an example. MUSE is more
intuitive to understand than Hamming code due to its integer arithmetic and the
simple idea of the one-to-one mapping of residues to errors.

# Abstract
> Residue codes have been traditionally used for compute error correction rather
> than storage error correction. In this paper, we use these codes for storage
> error correction with surprising results. We find that adapting residue codes
> to modern memory systems offers a level of error correction comparable to
> traditional schemes such as Reed-Solomon with fewer bits of storage. For
> instance, our adaptation of residue code – MUSE ECC – can offer ChipKill
> protection using approximately 30% fewer bits. We show that the storage gains
> can be used to hold metadata needed for emerging security functionality such
> as memory tagging or to provide better detection capabilities against
> Rowhammer attacks. Our evaluation shows that memory tagging in a MUSE-enabled
> system shows a 12% reduction in memory bandwidth utilization while providing
> the same level of error correction as a traditional ECC baseline without a
> noticeable loss of performance. Thus, our work demonstrates a new, flexible
> primitive for co-designing reliability with security and performance.

[Authors Preprint](https://arxiv.org/abs/2107.09245)