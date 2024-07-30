---
layout: post
title: "My paper ''Polymorphic Error Correction'' was accepted to MICRO-2024!"
comments: true
description: "Dissemination of research ideas"
keywords: "paper, MICRO’57"
---

My paper titled ''Polymorphic Error Correction'' was accepted to MICRO-2024. 

The paper's main idea is to co-design for security and reliability. We assume
that the baseline system already comes with MACs for data integrity (e.g., Intel
TDX) and standard level of ECC, i.e., Intel's SDDC. 

We design a new scheme with iterative error correction (like Intel's SDDC) that
relies on MAC verification to validate the correction outcome. To improve error
coverage, we design a novel ECC scheme that can reinterpret the same set of ECC
check bits for any fault model. In other words, you encode the check bits once,
like with any other error correction method, but the decoding can be done for a
variety of fault models: ChipKill, Single Symbol Correction, Double-bit error,
Tripple-bit Error, Double Bounded Fault, etc. Thus, unlike conventional error
correction schemes with limited fault model support, Polymorphic ECC corrects
more errors. We evaluated our scheme on a series of DDR4-based Rowhammer
patterns and found that Polymorphic ECC corrects more patterns than other
state-of-the-art ECC schemes. 

