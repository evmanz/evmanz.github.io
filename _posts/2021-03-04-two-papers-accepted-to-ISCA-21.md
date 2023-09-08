---
layout: post
title: "Two of our papers got accepted to ISCA'21!"
comments: true
description: "Announcement about our paper acceptance"
keywords: "paper, acceptance, MICRO’55"
---

Two projects I worked on resulted in ISCA'21 papers! Both of the papers are
examples of hardware/software co-design for security. 

The abstracts are posted below, and please read both papers to learn more!

## No-FAT Abstract
> Memory safety continues to be a significant software reliability and security
> problem, and low overhead and low complexity hardware solutions have eluded
> computer designers. In this paper, we explore a pathway to deployable memory
> safety defenses. Our technique builds on a recent trend in software: the usage
> of binning memory allocators. We observe that if memory allocation sizes
> (e.g., malloc sizes) are made an architectural feature, then it is possible to
> overcome many of the thorny issues with traditional approaches to memory
> safety such as compatibility with unsecured software and significant
> performance degradation. We show that our architecture, No-FAT, incurs an
> overhead of 8% on SPEC CPU2017 benchmarks, and our VLSI measurements show low
> power and area overheads. Finally, as No-FAT’s hardware is aware of the memory
> allocation sizes, it effectively mitigates certain speculative attacks (e.g.,
> Spectre-V1) with no additional cost. When our solution is used for
> pre-deployment fuzz testing it can improve fuzz testing bandwidth by an order
> of magnitude compared to state-of-the-art approaches.


[No-FAT Paper](https://ieeexplore.ieee.org/document/9499774)


## ZeRØ Abstract 
> A large class of today’s systems require high levels of availability and
> security. Unfortunately, state-of-the-art security solutions tend to induce
> crashes and raise exceptions when under attack, trading off availability for
> security. In this work, we propose ZeRØ, a pointer integrity mechanism that
> can continue program execution even when under attack. ZeRØ proposes unique
> memory instructions and a novel metadata encoding scheme to protect code and
> data pointers. The combination of instructions and metadata allows ZeRØ to
> avoid explicitly tagging every word in memory, eliminating performance
> overheads. Moreover, ZeRØ is a deterministic security primitive that requires
> minor microarchitectural changes. We show that ZeRØ is better than
> commercially available state-of-the-art hardware primitives, e.g., ARM’s
> Pointer Authentication (PAC), by a significant margin. ZeRØ incurs zero
> performance overheads on the SPEC CPU2017 benchmarks, and our VLSI
> measurements show low power and area overheads.

[ZeRØ Paper](https://ieeexplore.ieee.org/document/9499806)