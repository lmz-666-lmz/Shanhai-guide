package com.shanhai.guide.controller;

import com.shanhai.guide.common.ApiResponse;
import com.shanhai.guide.entity.TUserSession;
import com.shanhai.guide.service.SessionGuardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * 用户共创上传控制器
 * 仅允许已登录非 guest 用户上传共创申请附件图片，
 * 与管理员上传接口隔离，且不依赖管理员 Token。
 */
@RestController
@RequestMapping("/api/user/upload")
public class UserUploadController {

    private static final Logger log = LoggerFactory.getLogger(UserUploadController.class);

    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(Arrays.asList(
            ".jpg", ".jpeg", ".png", ".webp"
    ));

    private static final Set<String> ALLOWED_MIME_TYPES = new HashSet<>(Arrays.asList(
            "image/jpeg", "image/png", "image/webp"
    ));

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    private final SessionGuardService sessionGuardService;

    public UserUploadController(SessionGuardService sessionGuardService) {
        this.sessionGuardService = sessionGuardService;
    }

    /**
     * 用户共创申请图片上传
     * 必须携带有效 sessionId，guest 不允许上传。
     */
    @PostMapping("/application-image")
    public ApiResponse<Map<String, String>> uploadApplicationImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sessionId") String sessionId) {

        // 校验用户会话：必须已登录且非 guest
        sessionGuardService.requireActiveUserAction(sessionId);

        if (file == null || file.isEmpty()) {
            return ApiResponse.error(400, "文件不能为空");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            return ApiResponse.error(400, "图片不能超过 5MB");
        }

        String originalFilename = file.getOriginalFilename();
        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_MIME_TYPES.contains(contentType)) {
            return ApiResponse.error(400, "仅支持 jpg、jpeg、png、webp 格式图片");
        }

        String extension = null;
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase(Locale.ROOT);
            if (ALLOWED_EXTENSIONS.contains(ext)) {
                extension = ext;
            }
        }
        if (extension == null) {
            extension = mimeToExtension(contentType);
        }
        if (extension == null || !isExtensionCompatibleWithMime(extension, contentType)) {
            return ApiResponse.error(400, "仅支持 jpg、jpeg、png、webp 格式图片");
        }

        String newFilename = UUID.randomUUID().toString() + extension;

        Path uploadDir = Paths.get(System.getProperty("user.dir"), "uploads").toAbsolutePath().normalize();
        try {
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }
        } catch (IOException e) {
            log.error("创建上传目录失败: {}", uploadDir, e);
            return ApiResponse.error(500, "服务器上传目录创建失败");
        }

        Path dest = uploadDir.resolve(newFilename).normalize();
        if (!dest.startsWith(uploadDir)) {
            return ApiResponse.error(400, "非法的文件路径");
        }

        try {
            file.transferTo(dest.toFile());
            log.info("用户共创图片上传成功: {} -> {}", originalFilename, dest);

            Map<String, String> data = new HashMap<>();
            data.put("url", "/uploads/" + newFilename);
            data.put("filename", newFilename);
            return ApiResponse.success("上传成功", data);
        } catch (IOException e) {
            log.error("文件写入失败: {}", dest, e);
            return ApiResponse.error(500, "文件上传失败");
        }
    }

    private String mimeToExtension(String mimeType) {
        if (mimeType == null) return null;
        switch (mimeType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg": return ".jpg";
            case "image/png":  return ".png";
            case "image/webp": return ".webp";
            default: return null;
        }
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) return "";
        String normalized = contentType.toLowerCase(Locale.ROOT).trim();
        int semicolonIndex = normalized.indexOf(';');
        return semicolonIndex >= 0 ? normalized.substring(0, semicolonIndex).trim() : normalized;
    }

    private boolean isExtensionCompatibleWithMime(String extension, String mimeType) {
        if (".jpg".equals(extension) || ".jpeg".equals(extension)) {
            return "image/jpeg".equals(mimeType);
        }
        if (".png".equals(extension)) {
            return "image/png".equals(mimeType);
        }
        if (".webp".equals(extension)) {
            return "image/webp".equals(mimeType);
        }
        return false;
    }
}
