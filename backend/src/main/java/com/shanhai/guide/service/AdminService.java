package com.shanhai.guide.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.shanhai.guide.entity.TAdmin;

public interface AdminService extends IService<TAdmin> {

    TAdmin login(String username, String password);

    TAdmin getByUsername(String username);

    void updatePassword(Long adminId, String oldPassword, String newPassword);
}