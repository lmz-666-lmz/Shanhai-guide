package com.shanhai.guide.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.shanhai.guide.entity.TUser;
import com.shanhai.guide.exception.BusinessException;
import com.shanhai.guide.mapper.UserMapper;
import com.shanhai.guide.service.AuthService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl extends ServiceImpl<UserMapper, TUser> implements AuthService {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public TUser login(String username, String password) {
        TUser user = getUserByUsername(username);
        if (user == null) {
            throw new BusinessException(401, "账号不存在，请检查用户名或先注册");
        }
        if (user.getStatus() != 1) {
            throw new BusinessException(403, "该账号已停用，请联系管理员");
        }
        if (passwordEncoder.matches(password, user.getPassword())) {
            return user;
        }
        throw new BusinessException(401, "密码错误，请重新输入");
    }

    @Override
    public TUser register(String username, String password, String nickname, String userMode) {
        if (getUserByUsername(username) != null) {
            throw new BusinessException(409, "该用户名已被使用，请更换后重试");
        }
        TUser user = new TUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname);
        user.setUserMode(userMode);
        user.setStatus(1);
        save(user);
        return user;
    }

    @Override
    public TUser getUserById(Long id) {
        return getById(id);
    }

    @Override
    public TUser getUserByUsername(String username) {
        LambdaQueryWrapper<TUser> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TUser::getUsername, username);
        return getOne(wrapper);
    }
}
