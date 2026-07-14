package com.shanhai.guide.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;
    private final String[] allowedOriginPatterns;

    public WebConfig(AdminAuthInterceptor adminAuthInterceptor,
                     @Value("${app.cors.allowed-origin-patterns:http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174}") String allowedOriginPatterns) {
        this.adminAuthInterceptor = adminAuthInterceptor;
        this.allowedOriginPatterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toArray(String[]::new);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 使用 Paths.get 构建跨平台路径，再通过 toUri() 得到正确的 file: URI
        Path uploadPath = Paths.get(System.getProperty("user.dir"), "uploads");
        String uploadLocation = uploadPath.toUri().toString();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadLocation);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns(
                        "/api/admin/**",
                        "/api/feedback/admin/**",
                        "/api/reserve/admin/**",
                        "/api/spot",
                        "/api/spot/**",
                        "/api/route",
                        "/api/route/**",
                        "/api/activity",
                        "/api/activity/**"
                );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(allowedOriginPatterns)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
        // /uploads/** 也需要允许跨域访问（静态资源）
        registry.addMapping("/uploads/**")
                .allowedOriginPatterns(allowedOriginPatterns)
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
