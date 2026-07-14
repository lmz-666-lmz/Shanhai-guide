package com.shanhai.guide.service;

import com.shanhai.guide.entity.dto.NarrationRequest;
import com.shanhai.guide.entity.dto.NarrationResponse;

public interface NarrationService {
    NarrationResponse generateNarration(NarrationRequest request);
}
