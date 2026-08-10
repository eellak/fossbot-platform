from utils.ai.providers.google import GoogleProvider
from utils.ai.providers.openai import OpenAIProvider
from utils.ai.providers.openai_compatible import OpenAICompatibleProvider


PROVIDER_TYPES = {
    "openai": OpenAIProvider,
    "google": GoogleProvider,
    "openai_compatible": OpenAICompatibleProvider,
}


def hosted_provider(provider_type: str, **kwargs):
    provider_class = PROVIDER_TYPES.get(provider_type)
    if provider_class is None:
        raise ValueError("Provider is not available to the hosted runtime")
    return provider_class(**kwargs)
