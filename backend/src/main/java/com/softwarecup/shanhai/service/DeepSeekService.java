package com.softwarecup.shanhai.service;

import com.softwarecup.shanhai.config.DeepSeekProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Optional;

@Service
public class DeepSeekService {

    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);

    private final DeepSeekProperties properties;
    private final RestClient.Builder restClientBuilder;

    public DeepSeekService(DeepSeekProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClientBuilder = restClientBuilder;
    }

    public Optional<String> chat(String systemPrompt, String userMessage) {
        if (!StringUtils.hasText(properties.getApiKey())) {
            log.warn("DeepSeek API key is not configured. Using fallback chat response.");
            return Optional.empty();
        }

        try {
            RestClient restClient = restClientBuilder
                    .baseUrl(properties.getBaseUrl())
                    .build();

            DeepSeekChatResponse response = restClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .body(new DeepSeekChatRequest(
                            properties.getModel(),
                            List.of(
                                    new DeepSeekMessage("system", systemPrompt),
                                    new DeepSeekMessage("user", userMessage)
                            ),
                            0.7
                    ))
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            return extractAnswer(response);
        } catch (RestClientException ex) {
            log.warn("DeepSeek API call failed: {}", ex.getMessage());
            return Optional.empty();
        } catch (RuntimeException ex) {
            log.warn("DeepSeek response handling failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private Optional<String> extractAnswer(DeepSeekChatResponse response) {
        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            log.warn("DeepSeek API returned an empty response.");
            return Optional.empty();
        }

        DeepSeekChoice firstChoice = response.choices().get(0);
        if (firstChoice == null || firstChoice.message() == null
                || !StringUtils.hasText(firstChoice.message().content())) {
            log.warn("DeepSeek API returned a response without message content.");
            return Optional.empty();
        }

        return Optional.of(firstChoice.message().content().trim());
    }

    private record DeepSeekChatRequest(
            String model,
            List<DeepSeekMessage> messages,
            double temperature
    ) {
    }

    private record DeepSeekMessage(
            String role,
            String content
    ) {
    }

    private record DeepSeekChatResponse(
            List<DeepSeekChoice> choices
    ) {
    }

    private record DeepSeekChoice(
            DeepSeekMessage message
    ) {
    }
}
