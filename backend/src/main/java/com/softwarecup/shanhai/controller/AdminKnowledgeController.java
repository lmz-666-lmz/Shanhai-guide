package com.softwarecup.shanhai.controller;

import com.softwarecup.shanhai.dto.KnowledgeChunkResponse;
import com.softwarecup.shanhai.dto.KnowledgeDocRequest;
import com.softwarecup.shanhai.dto.KnowledgeDocResponse;
import com.softwarecup.shanhai.service.AdminKnowledgeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/knowledge")
public class AdminKnowledgeController {

    private final AdminKnowledgeService adminKnowledgeService;

    public AdminKnowledgeController(AdminKnowledgeService adminKnowledgeService) {
        this.adminKnowledgeService = adminKnowledgeService;
    }

    @GetMapping("/docs")
    public List<KnowledgeDocResponse> listDocs(@RequestParam(required = false) Boolean enabled) {
        return adminKnowledgeService.listDocs(enabled);
    }

    @GetMapping("/docs/{id}")
    public KnowledgeDocResponse getDoc(@PathVariable Long id) {
        return adminKnowledgeService.getDoc(id);
    }

    @PostMapping("/docs")
    public ResponseEntity<KnowledgeDocResponse> createDoc(@Valid @RequestBody KnowledgeDocRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminKnowledgeService.createDoc(request));
    }

    @PutMapping("/docs/{id}")
    public KnowledgeDocResponse updateDoc(
            @PathVariable Long id,
            @Valid @RequestBody KnowledgeDocRequest request
    ) {
        return adminKnowledgeService.updateDoc(id, request);
    }

    @PatchMapping("/docs/{id}/enabled")
    public KnowledgeDocResponse setEnabled(
            @PathVariable Long id,
            @RequestParam Boolean enabled
    ) {
        return adminKnowledgeService.setEnabled(id, enabled);
    }

    @DeleteMapping("/docs/{id}")
    public ResponseEntity<Void> deleteDoc(@PathVariable Long id) {
        adminKnowledgeService.deleteDoc(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/docs/{id}/chunks")
    public List<KnowledgeChunkResponse> listChunksByDoc(@PathVariable Long id) {
        return adminKnowledgeService.listChunksByDoc(id);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of(
                        "status", 404,
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getField() + "：" + error.getDefaultMessage())
                .collect(Collectors.joining("；"));

        return ResponseEntity.badRequest()
                .body(Map.of(
                        "status", 400,
                        "message", message
                ));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of(
                        "status", 400,
                        "message", "缺少必要参数：" + ex.getParameterName()
                ));
    }
}
