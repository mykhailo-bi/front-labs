from django import forms
from lab3_app.models import Review, User, Product


class ReviewForm(forms.ModelForm):
    class Meta:
        model = Review
        fields = ['user', 'product', 'rating', 'text']