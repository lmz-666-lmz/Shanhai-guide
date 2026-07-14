 package com.shanhai.guide;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.shanhai.guide.mapper")
public class ShanhaiGuideApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShanhaiGuideApplication.class, args);
    }
}







