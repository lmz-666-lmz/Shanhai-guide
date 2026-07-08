package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.ChatRequest;
import com.softwarecup.shanhai.dto.ChatResponse;
import com.softwarecup.shanhai.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return chatService.chat(request);
    }
}
