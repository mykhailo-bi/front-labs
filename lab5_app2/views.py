from django.shortcuts import render, redirect
from .NetworkHelper import NetworkHelper

nh = NetworkHelper('http://localhost:9000/api', 'user', 'user')

def course_list(request):
    status, data = nh.get_list('courses')
    courses = data if status == 200 else []
    return render(request, 'lab5_app2/course_list.html', {'courses': courses})

def course_detail(request, id):
    status, course = nh.get_item('courses', id)
    if status != 200:
        course = None
    return render(request, 'lab5_app2/course_detail.html', {'course': course})

def course_create(request):
    if request.method == 'POST':
        data = {
            'course_name': request.POST.get('course_name'),
            'description': request.POST.get('description'),
            'duration': int(request.POST.get('duration') or 0),
            'price': float(request.POST.get('price') or 0.0)
        }
        status, resp = nh.create_item('courses', data)
        if status in (200, 201):
            new_id = resp.get('course_id') or resp.get('id')
            if new_id:
                return redirect('lab5_app2:course_detail', id=new_id)
            return redirect('lab5_app2:course_list')
        errors = resp if isinstance(resp, dict) else {'error': 'Create failed'}
        return render(request, 'lab5_app2/course_form.html', {'errors': errors, 'data': data})
    return render(request, 'lab5_app2/course_form.html', {})

def course_edit(request, id):
    if request.method == 'POST':
        data = {
            'course_name': request.POST.get('course_name'),
            'description': request.POST.get('description'),
            'duration': int(request.POST.get('duration') or 0),
            'price': float(request.POST.get('price') or 0.0)
        }
        status, resp = nh.update_item('courses', id, data)
        if status in (200, 201):
            new_id = resp.get('course_id') or resp.get('id')
            if new_id:
                return redirect('lab5_app2:course_detail', id=new_id)
            return redirect('lab5_app2:course_list')
        errors = resp if isinstance(resp, dict) else {'error': 'Update failed'}
        return render(request, 'lab5_app2/course_form.html', {'errors': errors, 'data': data, 'editing': True})
    status, course = nh.get_item('courses', id)
    data = course if status == 200 else {}
    return render(request, 'lab5_app2/course_form.html', {'data': data, 'editing': True})

def course_delete(request, id):
    if request.method == 'POST':
        nh.delete_item('courses', id)
        return redirect('lab5_app2:course_list')
    status, course = nh.get_item('courses', id)
    if status != 200:
        course = None
    return render(request, 'lab5_app2/course_delete_confirm.html', {'course': course})


def student_list(request):
    status, data = nh.get_list('students')
    students = data if status == 200 else []
    return render(request, 'lab5_app2/student_list.html', {'students': students})

def student_detail(request, id):
    status, student = nh.get_item('students', id)
    if status != 200:
        student = None
    return render(request, 'lab5_app2/student_detail.html', {'student': student})

def student_create(request):
    if request.method == 'POST':
        data = {
            'first_name': request.POST.get('first_name'),
            'last_name': request.POST.get('last_name'),
            'email': request.POST.get('email'),
            'phone': request.POST.get('phone') or None
        }
        status, resp = nh.create_item('students', data)
        if status in (200, 201):
            new_id = resp.get('student_id') or resp.get('id')
            if new_id:
                return redirect('lab5_app2:student_detail', id=new_id)
            return redirect('lab5_app2:student_list')
        errors = resp if isinstance(resp, dict) else {'error': 'Create failed'}
        return render(request, 'lab5_app2/student_form.html', {'errors': errors, 'data': data})
    return render(request, 'lab5_app2/student_form.html', {})

def student_edit(request, id):
    if request.method == 'POST':
        data = {
            'first_name': request.POST.get('first_name'),
            'last_name': request.POST.get('last_name'),
            'email': request.POST.get('email'),
            'phone': request.POST.get('phone') or None
        }
        status, resp = nh.update_item('students', id, data)
        if status in (200, 201):
            new_id = resp.get('student_id') or resp.get('id')
            if new_id:
                return redirect('lab5_app2:student_detail', id=new_id)
            return redirect('lab5_app2:student_list')
        errors = resp if isinstance(resp, dict) else {'error': 'Update failed'}
        return render(request, 'lab5_app2/student_form.html', {'errors': errors, 'data': data, 'editing': True})
    status, student = nh.get_item('students', id)
    data = student if status == 200 else {}
    return render(request, 'lab5_app2/student_form.html', {'data': data, 'editing': True})

def student_delete(request, id):
    if request.method == 'POST':
        nh.delete_item('students', id)
        return redirect('lab5_app2:student_list')
    status, student = nh.get_item('students', id)
    if status != 200:
        student = None
    return render(request, 'lab5_app2/student_delete_confirm.html', {'student': student})
