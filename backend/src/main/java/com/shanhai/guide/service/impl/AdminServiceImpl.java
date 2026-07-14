package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TAdmin;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.AdminMapper;
import com.shanhai.guide.service.AdminService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AdminServiceImpl extends ServiceImpl<AdminMapper, TAdmin> implements AdminService {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public TAdmin login(String username, String password) {
        TAdmin admin = getByUsername(username);
        if (admin != null && admin.getStatus() == 1) {
            String storedPassword = admin.getPassword();
            if (password != null && isBcryptHash(storedPassword) && passwordEncoder.matches(password, storedPassword)) {
                return admin;
            }
            if (password != null && storedPassword != null && password.equals(storedPassword)) {
                admin.setPassword(passwordEncoder.encode(password));
                updateById(admin);
                return admin;
            }
        }
        return null;
    }

    @Override
    public TAdmin getByUsername(String username) {
        return getOne(new LambdaQueryWrapper<TAdmin>()
                .eq(TAdmin::getUsername, username));
    }

    @Override
    public void updatePassword(Long adminId, String oldPassword, String newPassword) {
        TAdmin admin = getById(adminId);
        if (admin == null) {
            throw new BusinessException(404, "管理员不存在");
        }

        // 验证旧密码
        String storedPassword = admin.getPassword();
        boolean oldPasswordValid = false;
        if (oldPassword != null && isBcryptHash(storedPassword) && passwordEncoder.matches(oldPassword, storedPassword)) {
            oldPasswordValid = true;
        }
        if (oldPassword != null && storedPassword != null && oldPassword.equals(storedPassword)) {
            oldPasswordValid = true;
        }
        if (!oldPasswordValid) {
            throw new BusinessException(400, "旧密码错误");
        }

        // 设置新密码
        admin.setPassword(passwordEncoder.encode(newPassword));
        updateById(admin);
    }

    private boolean isBcryptHash(String password) {
        return password != null && password.matches("^\\$2[aby]\\$\\d{2}\\$.+");
    }
}
