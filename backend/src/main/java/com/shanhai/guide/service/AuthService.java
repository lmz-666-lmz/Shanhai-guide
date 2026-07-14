package com.shanhai.guide.service;

import com.shanhai.guide.entity.TUser;

public interface AuthService {

    TUser login(String username, String password);

    TUser register(String username, String password, String nickname, String userMode);

    TUser getUserById(Long id);

    TUser getUserByUsername(String username);
}
